import {
  Prisma,
  ProductStatus,
  TransactionStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../configs/database.config";
import { HttpError } from "../errors/http-error";
import {
  disputeRepository,
  type DisputeClientLike,
} from "../repositories/dispute.repository";
import type {
  CreateDisputeInput,
  ResolveDisputeInput,
} from "../validators/dispute.validator";

type AuthenticatedUser = {
  id: string;
  role: UserRole;
};

type DisputeStatusValue =
  | "OPEN"
  | "UNDER_REVIEW"
  | "RESOLVED_BUYER"
  | "RESOLVED_SELLER"
  | "REJECTED";

const disputableTransactionStatuses: TransactionStatus[] = [
  TransactionStatus.FUNDS_HELD,
  TransactionStatus.SELLER_ACCEPTED,
  TransactionStatus.SHIPPED,
];

type VisibleDispute = {
  status: DisputeStatusValue;
  raisedById: string;
  transaction: {
    buyerId: string;
    sellerId: string;
    productId: string;
    status: TransactionStatus;
  };
};

const findDisputeOrThrow = async (disputeId: string) => {
  const dispute = await disputeRepository.findById(disputeId);

  if (!dispute) {
    throw new HttpError(404, "Dispute not found");
  }

  return dispute;
};

const assertCanViewDispute = (
  dispute: VisibleDispute,
  currentUser: AuthenticatedUser,
) => {
  const canView =
    currentUser.role === UserRole.ADMIN ||
    dispute.transaction.buyerId === currentUser.id ||
    dispute.transaction.sellerId === currentUser.id;

  if (!canView) {
    throw new HttpError(403, "You do not have permission to view this dispute");
  }
};

const assertAdmin = (currentUser: AuthenticatedUser) => {
  if (currentUser.role !== UserRole.ADMIN) {
    throw new HttpError(403, "Only admins can perform this action");
  }
};

export const disputeService = {
  async createDispute(
    payload: CreateDisputeInput,
    currentUser: AuthenticatedUser,
  ) {
    const disputeId = await prisma.$transaction(async (tx) => {
      const transaction = await tx.tradeTransaction.findUnique({
        where: { id: payload.transactionId },
      });

      if (!transaction) {
        throw new HttpError(404, "Transaction not found");
      }

      if (transaction.buyerId !== currentUser.id) {
        throw new HttpError(403, "Only the buyer can raise a dispute");
      }

      if (!disputableTransactionStatuses.includes(transaction.status)) {
        throw new HttpError(
          409,
          "A dispute cannot be raised for the transaction in its current state",
        );
      }

      const existingDispute = await tx.dispute.findUnique({
        where: { transactionId: transaction.id },
      });

      if (existingDispute) {
        throw new HttpError(409, "A dispute already exists for this transaction");
      }

      const dispute = await disputeRepository.create(
        tx as Prisma.TransactionClient & DisputeClientLike,
        {
          transactionId: transaction.id,
          raisedById: currentUser.id,
          reason: payload.reason,
          description: payload.description.trim(),
          previousTransactionStatus: transaction.status,
        },
      );

      await tx.tradeTransaction.update({
        where: { id: transaction.id },
        data: { status: TransactionStatus.DISPUTED },
      });

      return dispute.id;
    });

    const dispute = await disputeRepository.findById(disputeId);

    if (!dispute) {
      throw new HttpError(500, "Failed to create dispute");
    }

    return dispute;
  },

  async getMyDisputes(currentUser: AuthenticatedUser) {
    return disputeRepository.findVisibleDisputes(currentUser.id);
  },

  async getDisputeById(disputeId: string, currentUser: AuthenticatedUser) {
    const dispute = await findDisputeOrThrow(disputeId);
    assertCanViewDispute(dispute, currentUser);
    return dispute;
  },

  async markUnderReview(disputeId: string, currentUser: AuthenticatedUser) {
    assertAdmin(currentUser);

    const dispute = await findDisputeOrThrow(disputeId);

    if (dispute.status !== "OPEN") {
      throw new HttpError(
        409,
        "Only open disputes can be moved to under review",
      );
    }

    return disputeRepository.update(
      prisma,
      disputeId,
      {
        status: "UNDER_REVIEW",
      },
    );
  },

  async resolveDispute(
    disputeId: string,
    payload: ResolveDisputeInput,
    currentUser: AuthenticatedUser,
  ) {
    assertAdmin(currentUser);

    const dispute = await findDisputeOrThrow(disputeId);

    if (dispute.status !== "UNDER_REVIEW") {
      throw new HttpError(
        409,
        "Only disputes under review can be resolved",
      );
    }

    if (dispute.transaction.status !== TransactionStatus.DISPUTED) {
      throw new HttpError(
        409,
        "Only disputed transactions can be resolved",
      );
    }

    const now = new Date();

    return prisma.$transaction(async (tx) => {
      if (payload.decision === "REFUND_BUYER") {
        await tx.tradeTransaction.update({
          where: { id: dispute.transactionId },
          data: {
            status: TransactionStatus.BUYER_REFUNDED,
            refundedAt: now,
          },
        });

        await tx.product.update({
          where: { id: dispute.transaction.productId },
          data: {
            status: ProductStatus.AVAILABLE,
          },
        });

        return disputeRepository.update(
          tx as Prisma.TransactionClient & DisputeClientLike,
          disputeId,
          {
            status: "RESOLVED_BUYER",
            resolvedAt: now,
            resolvedById: currentUser.id,
            adminNote: payload.adminNote.trim(),
          },
        );
      }

      if (payload.decision === "RELEASE_SELLER") {
        await tx.tradeTransaction.update({
          where: { id: dispute.transactionId },
          data: {
            status: TransactionStatus.FUNDS_RELEASED,
            releasedAt: now,
          },
        });

        await tx.product.update({
          where: { id: dispute.transaction.productId },
          data: {
            status: ProductStatus.SOLD,
          },
        });

        return disputeRepository.update(
          tx as Prisma.TransactionClient & DisputeClientLike,
          disputeId,
          {
            status: "RESOLVED_SELLER",
            resolvedAt: now,
            resolvedById: currentUser.id,
            adminNote: payload.adminNote.trim(),
          },
        );
      }

      await tx.tradeTransaction.update({
        where: { id: dispute.transactionId },
        data: {
          status: dispute.previousTransactionStatus,
        },
      });

      return disputeRepository.update(
        tx as Prisma.TransactionClient & DisputeClientLike,
        disputeId,
        {
          status: "REJECTED",
          resolvedAt: now,
          resolvedById: currentUser.id,
          adminNote: payload.adminNote.trim(),
        },
      );
    });
  },
};

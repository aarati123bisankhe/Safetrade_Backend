import { ProductModel, TradeTransactionModel } from "../db/models";
import {
  ProductStatus,
  TransactionStatus,
  UserRole,
} from "../db/types";
import { runInTransaction } from "../configs/database.config";
import { HttpError } from "../errors/http-error";
import { transactionRepository } from "../repositories/transaction.repository";
import { auditLogService, type RequestContext } from "./audit-log.service";
import { CreateTransactionInput } from "../validators/transaction.validator";

type AuthenticatedUser = {
  id: string;
  role: UserRole;
};

const assertCanViewTransaction = (
  transaction: {
    buyerId: string;
    sellerId: string;
  },
  currentUser: AuthenticatedUser,
) => {
  const canView =
    currentUser.role === UserRole.ADMIN ||
    transaction.buyerId === currentUser.id ||
    transaction.sellerId === currentUser.id;

  if (!canView) {
    throw new HttpError(403, "You do not have permission to view this transaction");
  }
};

const assertSellerOwnership = (
  transaction: {
    sellerId: string;
  },
  currentUser: AuthenticatedUser,
) => {
  if (transaction.sellerId !== currentUser.id) {
    throw new HttpError(403, "Only the seller can perform this action");
  }
};

const assertBuyerOwnership = (
  transaction: {
    buyerId: string;
  },
  currentUser: AuthenticatedUser,
) => {
  if (transaction.buyerId !== currentUser.id) {
    throw new HttpError(403, "Only the buyer can perform this action");
  }
};

const findTransactionOrThrow = async (transactionId: string) => {
  const transaction = await transactionRepository.findById(transactionId);

  if (!transaction) {
    throw new HttpError(404, "Transaction not found");
  }

  return transaction;
};

export const transactionService = {
  async createTransaction(
    payload: CreateTransactionInput,
    currentUser: AuthenticatedUser,
    context?: RequestContext,
  ) {
    return runInTransaction(async (session) => {
      const product = await ProductModel.findById(payload.productId).session(session).lean() as any;

      if (!product) {
        throw new HttpError(404, "Product not found");
      }

      if (String(product.sellerId) === currentUser.id) {
        throw new HttpError(403, "You cannot purchase your own product");
      }

      if (product.status === ProductStatus.SOLD || product.status === ProductStatus.REMOVED) {
        throw new HttpError(409, "This product cannot be purchased");
      }

      if (product.status !== ProductStatus.AVAILABLE) {
        throw new HttpError(409, "Product is not available for purchase");
      }

      const reservedProduct = await ProductModel.updateOne(
        {
          _id: payload.productId,
          status: ProductStatus.AVAILABLE,
        },
        {
          $set: { status: ProductStatus.RESERVED },
        },
        { session },
      );

      if (reservedProduct.modifiedCount !== 1) {
        throw new HttpError(409, "This product is no longer available");
      }

      const transaction = await transactionRepository.create(
        {
          buyerId: currentUser.id,
          sellerId: String(product.sellerId),
          productId: String(product._id),
          productName: product.name,
          agreedPrice: product.price,
          status: TransactionStatus.FUNDS_HELD,
        },
        session,
      );
      const transactionProductId =
        typeof transaction.productId === "string"
          ? transaction.productId
          : transaction.product?.id ?? String(product._id);

      await auditLogService.createLog(
        {
          eventType: "PRODUCT_RESERVED",
          actorId: currentUser.id,
          targetType: "Product",
          targetId: transactionProductId,
          description: "Product was reserved for an escrow transaction",
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          metadata: {
            transactionId: transaction.id,
            sellerId: transaction.sellerId,
            status: "RESERVED",
          },
        },
        session,
      );

      await auditLogService.createLog(
        {
          eventType: "TRANSACTION_CREATED",
          actorId: currentUser.id,
          targetType: "Transaction",
          targetId: transaction.id,
          description: "Buyer created an escrow-protected transaction",
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          metadata: {
            productId: transactionProductId,
            sellerId: transaction.sellerId,
            status: transaction.status,
          },
        },
        session,
      );

      return transaction;
    });
  },

  async getMyPurchases(currentUser: AuthenticatedUser) {
    return transactionRepository.findBuyerTransactions(currentUser.id);
  },

  async getMySales(currentUser: AuthenticatedUser) {
    return transactionRepository.findSellerTransactions(currentUser.id);
  },

  async getTransactionById(
    transactionId: string,
    currentUser: AuthenticatedUser,
  ) {
    const transaction = await findTransactionOrThrow(transactionId);
    assertCanViewTransaction(transaction, currentUser);
    return transaction;
  },

  async acceptTransaction(
    transactionId: string,
    currentUser: AuthenticatedUser,
    context?: RequestContext,
  ) {
    const transaction = await findTransactionOrThrow(transactionId);
    assertSellerOwnership(transaction, currentUser);

    if (transaction.status !== TransactionStatus.FUNDS_HELD) {
      throw new HttpError(
        409,
        "Only transactions with held funds can be accepted",
      );
    }

    return runInTransaction(async (session) => {
      const updatedTransaction = await transactionRepository.updateStatus(
        transactionId,
        {
          status: TransactionStatus.SELLER_ACCEPTED,
        },
        session,
      );

      await auditLogService.createLog(
        {
          eventType: "TRANSACTION_ACCEPTED",
          actorId: currentUser.id,
          targetType: "Transaction",
          targetId: updatedTransaction.id,
          description: "Seller accepted an escrow transaction",
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          metadata: {
            buyerId: updatedTransaction.buyerId,
            status: updatedTransaction.status,
          },
        },
        session,
      );

      return updatedTransaction;
    });
  },

  async shipTransaction(
    transactionId: string,
    currentUser: AuthenticatedUser,
    context?: RequestContext,
  ) {
    const transaction = await findTransactionOrThrow(transactionId);
    assertSellerOwnership(transaction, currentUser);

    if (transaction.status !== TransactionStatus.SELLER_ACCEPTED) {
      throw new HttpError(
        409,
        "Only accepted transactions can be marked as shipped",
      );
    }

    return runInTransaction(async (session) => {
      const updatedTransaction = await transactionRepository.updateStatus(
        transactionId,
        {
          status: TransactionStatus.SHIPPED,
        },
        session,
      );

      await auditLogService.createLog(
        {
          eventType: "TRANSACTION_SHIPPED",
          actorId: currentUser.id,
          targetType: "Transaction",
          targetId: updatedTransaction.id,
          description: "Seller marked a transaction as shipped",
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          metadata: {
            buyerId: updatedTransaction.buyerId,
            status: updatedTransaction.status,
          },
        },
        session,
      );

      return updatedTransaction;
    });
  },

  async confirmReceipt(
    transactionId: string,
    currentUser: AuthenticatedUser,
    context?: RequestContext,
  ) {
    const transaction = await findTransactionOrThrow(transactionId);
    assertBuyerOwnership(transaction, currentUser);

    if (transaction.status === TransactionStatus.FUNDS_RELEASED) {
      throw new HttpError(409, "Funds have already been released for this transaction");
    }

    if (transaction.status !== TransactionStatus.SHIPPED) {
      throw new HttpError(
        409,
        "Only shipped transactions can be confirmed",
      );
    }

    return runInTransaction(async (session) => {
      await ProductModel.findByIdAndUpdate(
        transaction.productId,
        { status: ProductStatus.SOLD },
        { session },
      );

      const updatedTransaction = await transactionRepository.updateStatus(
        transactionId,
        {
          status: TransactionStatus.FUNDS_RELEASED,
          buyerConfirmedAt: new Date(),
          releasedAt: new Date(),
        },
        session,
      );

      await auditLogService.createLog(
        {
          eventType: "RECEIPT_CONFIRMED",
          actorId: currentUser.id,
          targetType: "Transaction",
          targetId: updatedTransaction.id,
          description: "Buyer confirmed receipt of the product",
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          metadata: {
            productId: updatedTransaction.productId,
            status: updatedTransaction.status,
          },
        },
        session,
      );

      await auditLogService.createLog(
        {
          eventType: "FUNDS_RELEASED",
          actorId: currentUser.id,
          targetType: "Transaction",
          targetId: updatedTransaction.id,
          description: "Escrow funds were released after buyer confirmation",
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          metadata: {
            productId: updatedTransaction.productId,
            finalStatus: updatedTransaction.status,
          },
        },
        session,
      );

      return updatedTransaction;
    });
  },
};

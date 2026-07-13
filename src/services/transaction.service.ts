import {
  Prisma,
  ProductStatus,
  TransactionStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../configs/database.config";
import { HttpError } from "../errors/http-error";
import { transactionRepository } from "../repositories/transaction.repository";
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
  ) {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: {
          id: payload.productId,
        },
      });

      if (!product) {
        throw new HttpError(404, "Product not found");
      }

      if (product.sellerId === currentUser.id) {
        throw new HttpError(403, "You cannot purchase your own product");
      }

      if (product.status === ProductStatus.SOLD || product.status === ProductStatus.REMOVED) {
        throw new HttpError(409, "This product cannot be purchased");
      }

      if (product.status !== ProductStatus.AVAILABLE) {
        throw new HttpError(409, "Product is not available for purchase");
      }

      const reservedProduct = await tx.product.updateMany({
        where: {
          id: payload.productId,
          status: ProductStatus.AVAILABLE,
        },
        data: {
          status: ProductStatus.RESERVED,
        },
      });

      if (reservedProduct.count !== 1) {
        throw new HttpError(409, "This product is no longer available");
      }

      const transactionData: Prisma.TradeTransactionUncheckedCreateInput = {
        buyerId: currentUser.id,
        sellerId: product.sellerId,
        productId: product.id,
        productName: product.name,
        agreedPrice: product.price,
        status: "FUNDS_HELD",
      };

      return transactionRepository.create(
        tx as Prisma.TransactionClient & {
          tradeTransaction: {
            create: typeof prisma.tradeTransaction.create;
          };
        },
        transactionData,
      );
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
  ) {
    const transaction = await findTransactionOrThrow(transactionId);
    assertSellerOwnership(transaction, currentUser);

    if (transaction.status !== TransactionStatus.FUNDS_HELD) {
      throw new HttpError(
        409,
        "Only transactions with held funds can be accepted",
      );
    }

    return transactionRepository.updateStatus(
      prisma,
      transactionId,
      {
        status: TransactionStatus.SELLER_ACCEPTED,
      },
    );
  },

  async shipTransaction(
    transactionId: string,
    currentUser: AuthenticatedUser,
  ) {
    const transaction = await findTransactionOrThrow(transactionId);
    assertSellerOwnership(transaction, currentUser);

    if (transaction.status !== TransactionStatus.SELLER_ACCEPTED) {
      throw new HttpError(
        409,
        "Only accepted transactions can be marked as shipped",
      );
    }

    return transactionRepository.updateStatus(
      prisma,
      transactionId,
      {
        status: TransactionStatus.SHIPPED,
      },
    );
  },

  async confirmReceipt(
    transactionId: string,
    currentUser: AuthenticatedUser,
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

    return prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: transaction.productId },
        data: {
          status: ProductStatus.SOLD,
        },
      });

      return transactionRepository.updateStatus(
        tx as Prisma.TransactionClient & {
          tradeTransaction: {
            create: typeof prisma.tradeTransaction.create;
            update: typeof prisma.tradeTransaction.update;
          };
          product: {
            update: typeof prisma.product.update;
          };
        },
        transactionId,
        {
          status: TransactionStatus.FUNDS_RELEASED,
          buyerConfirmedAt: new Date(),
          releasedAt: new Date(),
        },
      );
    });
  },
};

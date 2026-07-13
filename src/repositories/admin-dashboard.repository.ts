import {
  AuditEventType,
  DisputeStatus,
  ProductStatus,
  TransactionStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../configs/database.config";

export const adminDashboardRepository = {
  async getSummary(since: Date) {
    const now = new Date();

    const [
      totalUsers,
      buyers,
      sellers,
      admins,
      currentlyLocked,
      totalProducts,
      availableProducts,
      reservedProducts,
      soldProducts,
      removedProducts,
      totalTransactions,
      fundsHeldTransactions,
      sellerAcceptedTransactions,
      shippedTransactions,
      disputedTransactions,
      fundsReleasedTransactions,
      buyerRefundedTransactions,
      cancelledTransactions,
      totalDisputes,
      openDisputes,
      underReviewDisputes,
      resolvedBuyerDisputes,
      resolvedSellerDisputes,
      rejectedDisputes,
      failedLoginsInPeriod,
      lockedAccountsInPeriod,
      unauthorizedAttemptsInPeriod,
      evidenceUploadsInPeriod,
      recentActivity,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.BUYER } }),
      prisma.user.count({ where: { role: UserRole.SELLER } }),
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
      prisma.user.count({ where: { lockedUntil: { gt: now } } }),
      prisma.product.count(),
      prisma.product.count({ where: { status: ProductStatus.AVAILABLE } }),
      prisma.product.count({ where: { status: ProductStatus.RESERVED } }),
      prisma.product.count({ where: { status: ProductStatus.SOLD } }),
      prisma.product.count({ where: { status: ProductStatus.REMOVED } }),
      prisma.tradeTransaction.count(),
      prisma.tradeTransaction.count({ where: { status: TransactionStatus.FUNDS_HELD } }),
      prisma.tradeTransaction.count({ where: { status: TransactionStatus.SELLER_ACCEPTED } }),
      prisma.tradeTransaction.count({ where: { status: TransactionStatus.SHIPPED } }),
      prisma.tradeTransaction.count({ where: { status: TransactionStatus.DISPUTED } }),
      prisma.tradeTransaction.count({ where: { status: TransactionStatus.FUNDS_RELEASED } }),
      prisma.tradeTransaction.count({ where: { status: TransactionStatus.BUYER_REFUNDED } }),
      prisma.tradeTransaction.count({ where: { status: TransactionStatus.CANCELLED } }),
      prisma.dispute.count(),
      prisma.dispute.count({ where: { status: DisputeStatus.OPEN } }),
      prisma.dispute.count({ where: { status: DisputeStatus.UNDER_REVIEW } }),
      prisma.dispute.count({ where: { status: DisputeStatus.RESOLVED_BUYER } }),
      prisma.dispute.count({ where: { status: DisputeStatus.RESOLVED_SELLER } }),
      prisma.dispute.count({ where: { status: DisputeStatus.REJECTED } }),
      prisma.loginAttempt.count({
        where: {
          successful: false,
          createdAt: { gte: since },
        },
      }),
      prisma.auditLog.count({
        where: {
          eventType: AuditEventType.ACCOUNT_LOCKED,
          createdAt: { gte: since },
        },
      }),
      prisma.auditLog.count({
        where: {
          eventType: AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
          createdAt: { gte: since },
        },
      }),
      prisma.auditLog.count({
        where: {
          eventType: AuditEventType.DISPUTE_EVIDENCE_UPLOADED,
          createdAt: { gte: since },
        },
      }),
      prisma.auditLog.findMany({
        where: {
          eventType: {
            in: [
              AuditEventType.ACCOUNT_LOCKED,
              AuditEventType.LOGIN_BLOCKED,
              AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
              AuditEventType.DISPUTE_OPENED,
              AuditEventType.DISPUTE_REFUNDED,
              AuditEventType.DISPUTE_RELEASED_TO_SELLER,
              AuditEventType.DISPUTE_EVIDENCE_UPLOADED,
              AuditEventType.FUNDS_RELEASED,
            ],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
        select: {
          id: true,
          eventType: true,
          actorId: true,
          targetType: true,
          targetId: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        buyers,
        sellers,
        admins,
        currentlyLocked,
      },
      products: {
        total: totalProducts,
        available: availableProducts,
        reserved: reservedProducts,
        sold: soldProducts,
        removed: removedProducts,
      },
      transactions: {
        total: totalTransactions,
        fundsHeld: fundsHeldTransactions,
        sellerAccepted: sellerAcceptedTransactions,
        shipped: shippedTransactions,
        disputed: disputedTransactions,
        fundsReleased: fundsReleasedTransactions,
        buyerRefunded: buyerRefundedTransactions,
        cancelled: cancelledTransactions,
      },
      disputes: {
        total: totalDisputes,
        open: openDisputes,
        underReview: underReviewDisputes,
        resolvedForBuyer: resolvedBuyerDisputes,
        resolvedForSeller: resolvedSellerDisputes,
        rejected: rejectedDisputes,
      },
      security: {
        failedLoginsLastPeriod: failedLoginsInPeriod,
        lockedAccounts: currentlyLocked,
        lockedEventsLastPeriod: lockedAccountsInPeriod,
        unauthorizedAttemptsLastPeriod: unauthorizedAttemptsInPeriod,
        evidenceUploadsLastPeriod: evidenceUploadsInPeriod,
      },
      recentActivity,
    };
  },
};

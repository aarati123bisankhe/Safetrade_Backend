import {
  AuditLogModel,
  DisputeModel,
  LoginAttemptModel,
  ProductModel,
  TradeTransactionModel,
  UserModel,
  normalizeMongoDoc,
} from "../db/models";
import {
  AuditEventType,
  DisputeStatus,
  ProductStatus,
  TransactionStatus,
  UserRole,
} from "../db/types";

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
      UserModel.countDocuments(),
      UserModel.countDocuments({ role: UserRole.BUYER }),
      UserModel.countDocuments({ role: UserRole.SELLER }),
      UserModel.countDocuments({ role: UserRole.ADMIN }),
      UserModel.countDocuments({ lockedUntil: { $gt: now } }),
      ProductModel.countDocuments(),
      ProductModel.countDocuments({ status: ProductStatus.AVAILABLE }),
      ProductModel.countDocuments({ status: ProductStatus.RESERVED }),
      ProductModel.countDocuments({ status: ProductStatus.SOLD }),
      ProductModel.countDocuments({ status: ProductStatus.REMOVED }),
      TradeTransactionModel.countDocuments(),
      TradeTransactionModel.countDocuments({ status: TransactionStatus.FUNDS_HELD }),
      TradeTransactionModel.countDocuments({ status: TransactionStatus.SELLER_ACCEPTED }),
      TradeTransactionModel.countDocuments({ status: TransactionStatus.SHIPPED }),
      TradeTransactionModel.countDocuments({ status: TransactionStatus.DISPUTED }),
      TradeTransactionModel.countDocuments({ status: TransactionStatus.FUNDS_RELEASED }),
      TradeTransactionModel.countDocuments({ status: TransactionStatus.BUYER_REFUNDED }),
      TradeTransactionModel.countDocuments({ status: TransactionStatus.CANCELLED }),
      DisputeModel.countDocuments(),
      DisputeModel.countDocuments({ status: DisputeStatus.OPEN }),
      DisputeModel.countDocuments({ status: DisputeStatus.UNDER_REVIEW }),
      DisputeModel.countDocuments({ status: DisputeStatus.RESOLVED_BUYER }),
      DisputeModel.countDocuments({ status: DisputeStatus.RESOLVED_SELLER }),
      DisputeModel.countDocuments({ status: DisputeStatus.REJECTED }),
      LoginAttemptModel.countDocuments({
        successful: false,
        createdAt: { $gte: since },
      }),
      AuditLogModel.countDocuments({
        eventType: AuditEventType.ACCOUNT_LOCKED,
        createdAt: { $gte: since },
      }),
      AuditLogModel.countDocuments({
        eventType: AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
        createdAt: { $gte: since },
      }),
      AuditLogModel.countDocuments({
        eventType: AuditEventType.DISPUTE_EVIDENCE_UPLOADED,
        createdAt: { $gte: since },
      }),
      AuditLogModel.find({
        eventType: {
          $in: [
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
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("eventType actorId targetType targetId description createdAt")
        .lean(),
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
      recentActivity: normalizeMongoDoc(recentActivity),
    };
  },
};

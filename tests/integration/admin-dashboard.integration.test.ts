import request from "supertest";
import {
  AuditEventType,
  DisputeStatus,
  Prisma,
  ProductStatus,
  TransactionStatus,
  UserRole,
} from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/configs/database.config";
import {
  clearDatabase,
  createDispute,
  createProduct,
  createTransaction,
  createUser,
  createUserSession,
} from "../helpers/test-data";

const dashboardPath = "/api/admin/dashboard";

describe("Admin Dashboard API", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  it("admin can access dashboard", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });

    const response = await request(app)
      .get(dashboardPath)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.users).toBeDefined();
    expect(response.body.data.products).toBeDefined();
    expect(response.body.data.transactions).toBeDefined();
    expect(response.body.data.disputes).toBeDefined();
    expect(response.body.data.security).toBeDefined();
    expect(Array.isArray(response.body.data.recentActivity)).toBe(true);
  });

  it("buyer receives 403", async () => {
    const buyer = await createUserSession({ role: UserRole.BUYER });

    const response = await request(app)
      .get(dashboardPath)
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(response.status).toBe(403);
  });

  it("seller receives 403", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });

    const response = await request(app)
      .get(dashboardPath)
      .set("Authorization", `Bearer ${seller.token}`);

    expect(response.status).toBe(403);
  });

  it("unauthenticated request receives 401", async () => {
    const response = await request(app).get(dashboardPath);

    expect(response.status).toBe(401);
  });

  it("invalid period receives 400", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });

    const response = await request(app)
      .get(`${dashboardPath}?period=90d`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(400);
  });

  it("user counts are correct", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });
    await createUser({ role: UserRole.BUYER });
    await createUser({ role: UserRole.BUYER });
    await createUser({ role: UserRole.SELLER });

    const response = await request(app)
      .get(dashboardPath)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.users.total).toBe(4);
    expect(response.body.data.users.buyers).toBe(2);
    expect(response.body.data.users.sellers).toBe(1);
    expect(response.body.data.users.admins).toBe(1);
  });

  it("product status counts are correct", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });
    const seller = await createUser({ role: UserRole.SELLER });
    await createProduct({ sellerId: seller.id, status: ProductStatus.AVAILABLE });
    await createProduct({ sellerId: seller.id, status: ProductStatus.RESERVED });
    await createProduct({ sellerId: seller.id, status: ProductStatus.SOLD });
    await createProduct({ sellerId: seller.id, status: ProductStatus.REMOVED });

    const response = await request(app)
      .get(dashboardPath)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.products.total).toBe(4);
    expect(response.body.data.products.available).toBe(1);
    expect(response.body.data.products.reserved).toBe(1);
    expect(response.body.data.products.sold).toBe(1);
    expect(response.body.data.products.removed).toBe(1);
  });

  it("transaction status counts are correct", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });
    const seller = await createUser({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
    const statuses = [
      TransactionStatus.FUNDS_HELD,
      TransactionStatus.SELLER_ACCEPTED,
      TransactionStatus.SHIPPED,
      TransactionStatus.DISPUTED,
      TransactionStatus.FUNDS_RELEASED,
      TransactionStatus.BUYER_REFUNDED,
      TransactionStatus.CANCELLED,
    ];

    for (const status of statuses) {
      const product = await createProduct({
        sellerId: seller.id,
        status:
          status === TransactionStatus.FUNDS_RELEASED
            ? ProductStatus.SOLD
            : ProductStatus.RESERVED,
      });

      await createTransaction({
        buyerId: buyer.id,
        sellerId: seller.id,
        productId: product.id,
        productName: product.name,
        agreedPrice: product.price,
        status,
      });
    }

    const response = await request(app)
      .get(dashboardPath)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.transactions.total).toBe(7);
    expect(response.body.data.transactions.fundsHeld).toBe(1);
    expect(response.body.data.transactions.sellerAccepted).toBe(1);
    expect(response.body.data.transactions.shipped).toBe(1);
    expect(response.body.data.transactions.disputed).toBe(1);
    expect(response.body.data.transactions.fundsReleased).toBe(1);
    expect(response.body.data.transactions.buyerRefunded).toBe(1);
    expect(response.body.data.transactions.cancelled).toBe(1);
  });

  it("dispute status counts are correct", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });
    const seller = await createUser({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
    const disputeStatuses = [
      DisputeStatus.OPEN,
      DisputeStatus.UNDER_REVIEW,
      DisputeStatus.RESOLVED_BUYER,
      DisputeStatus.RESOLVED_SELLER,
      DisputeStatus.REJECTED,
    ];

    for (const status of disputeStatuses) {
      const product = await createProduct({
        sellerId: seller.id,
        status: ProductStatus.RESERVED,
      });
      const transaction = await createTransaction({
        buyerId: buyer.id,
        sellerId: seller.id,
        productId: product.id,
        productName: product.name,
        agreedPrice: product.price,
        status: TransactionStatus.DISPUTED,
      });

      await createDispute({
        transactionId: transaction.id,
        raisedById: buyer.id,
        previousTransactionStatus: TransactionStatus.SHIPPED,
        status,
      });
    }

    const response = await request(app)
      .get(dashboardPath)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.disputes.total).toBe(5);
    expect(response.body.data.disputes.open).toBe(1);
    expect(response.body.data.disputes.underReview).toBe(1);
    expect(response.body.data.disputes.resolvedForBuyer).toBe(1);
    expect(response.body.data.disputes.resolvedForSeller).toBe(1);
    expect(response.body.data.disputes.rejected).toBe(1);
  });

  it("active account lock count is correct and expired locks are not counted", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });
    await createUser({ role: UserRole.BUYER });
    const lockedUser = await createUser({ role: UserRole.BUYER });
    const expiredLockUser = await createUser({ role: UserRole.SELLER });

    await prisma.user.update({
      where: { id: lockedUser.id },
      data: {
        failedLoginAttempts: 12,
        lockedUntil: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await prisma.user.update({
      where: { id: expiredLockUser.id },
      data: {
        failedLoginAttempts: 12,
        lockedUntil: new Date(Date.now() - 60 * 1000),
      },
    });

    const response = await request(app)
      .get(dashboardPath)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.users.currentlyLocked).toBe(1);
    expect(response.body.data.security.lockedAccounts).toBe(1);
  });

  it("failed-login count respects selected period", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });

    await prisma.loginAttempt.createMany({
      data: [
        {
          email: "recent-failure@example.com",
          successful: false,
          reason: "INVALID_CREDENTIALS",
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
        {
          email: "old-failure@example.com",
          successful: false,
          reason: "INVALID_CREDENTIALS",
          createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    const response = await request(app)
      .get(`${dashboardPath}?period=24h`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.security.failedLoginsLastPeriod).toBe(1);
  });

  it("unauthorised-attempt count respects selected period", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });

    await prisma.auditLog.createMany({
      data: [
        {
          eventType: AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
          description: "Recent unauthorized attempt",
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
        },
        {
          eventType: AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
          description: "Old unauthorized attempt",
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    const response = await request(app)
      .get(`${dashboardPath}?period=7d`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.security.unauthorizedAttemptsLastPeriod).toBe(1);
  });

  it("evidence-upload count respects selected period", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });

    await prisma.auditLog.createMany({
      data: [
        {
          eventType: AuditEventType.DISPUTE_EVIDENCE_UPLOADED,
          description: "Recent evidence upload",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          eventType: AuditEventType.DISPUTE_EVIDENCE_UPLOADED,
          description: "Old evidence upload",
          createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    const response = await request(app)
      .get(`${dashboardPath}?period=30d`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.security.evidenceUploadsLastPeriod).toBe(1);
  });

  it("returns only safe recent activity fields", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });
    const actor = await createUser({ role: UserRole.SELLER });

    await prisma.auditLog.create({
      data: {
        eventType: AuditEventType.FUNDS_RELEASED,
        actorId: actor.id,
        targetType: "Transaction",
        targetId: "transaction-1",
        description: "Funds were released",
        ipAddress: "127.0.0.1",
        userAgent: "private-agent",
        metadata: {
          token: "secret-token",
          storagePath: "/private/file.pdf",
        } as Prisma.InputJsonValue,
      },
    });

    const response = await request(app)
      .get(dashboardPath)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.recentActivity).toHaveLength(1);
    expect(response.body.data.recentActivity[0].eventType).toBe("FUNDS_RELEASED");

    const serialized = JSON.stringify(response.body.data.recentActivity);
    expect(serialized).not.toContain("ipAddress");
    expect(serialized).not.toContain("userAgent");
    expect(serialized).not.toContain("metadata");
    expect(serialized).not.toContain("storagePath");
    expect(serialized).not.toContain("token");
  });
});

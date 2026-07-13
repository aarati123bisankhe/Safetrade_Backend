import request from "supertest";
import { AuditEventType, ProductStatus, TransactionStatus, UserRole } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/configs/database.config";
import {
  clearDatabase,
  createProduct,
  createTransaction,
  createUser,
  createUserSession,
} from "../helpers/test-data";

const adminAuditPath = "/api/admin/audit-logs";

const assertNoSensitiveData = (value: unknown) => {
  const serialized = JSON.stringify(value);

  expect(serialized).not.toContain("\"password\":");
  expect(serialized).not.toContain("passwordHash");
  expect(serialized).not.toContain("Bearer ");
  expect(serialized).not.toContain("Authorization");
  expect(serialized).not.toContain("totpSecret");
  expect(serialized).not.toContain("oauthSecret");
  expect(serialized).not.toContain("cookieValue");
  expect(serialized).not.toContain("jwtSecret");
};

const findAuditLogByEvent = async (eventType: AuditEventType) => {
  return prisma.auditLog.findFirst({
    where: { eventType },
    orderBy: { createdAt: "desc" },
  });
};

describe("Audit Log API", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  it("registration creates USER_REGISTERED", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        username: "audit-register-user",
        email: "audit-register@example.com",
        password: "password123",
      });

    expect(response.status).toBe(201);

    const auditLog = await findAuditLogByEvent(AuditEventType.USER_REGISTERED);

    expect(auditLog).not.toBeNull();
    expect(auditLog?.targetType).toBe("User");
    assertNoSensitiveData(auditLog);
    assertNoSensitiveData(response.body);
  });

  it("successful login creates LOGIN_SUCCESS", async () => {
    const user = await createUser({
      email: "audit-login-success@example.com",
      password: "password123",
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: user.plainPassword,
      });

    expect(response.status).toBe(200);

    const auditLog = await findAuditLogByEvent(AuditEventType.LOGIN_SUCCESS);

    expect(auditLog).not.toBeNull();
    expect(auditLog?.actorId).toBe(user.id);
    assertNoSensitiveData(auditLog);
    assertNoSensitiveData(response.body);
  });

  it("failed login creates LOGIN_FAILURE", async () => {
    const user = await createUser({
      email: "audit-login-failure@example.com",
      password: "password123",
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: "wrong-password",
      });

    expect(response.status).toBe(401);

    const auditLog = await findAuditLogByEvent(AuditEventType.LOGIN_FAILURE);

    expect(auditLog).not.toBeNull();
    expect(auditLog?.actorId).toBe(user.id);
    assertNoSensitiveData(auditLog);
    assertNoSensitiveData(response.body);
  });

  it("product creation creates PRODUCT_CREATED", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });

    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({
        name: "Audit Product",
        description: "Product creation should be audited",
        price: 350,
        category: "ELECTRONICS",
        condition: "GOOD",
        location: "Kathmandu",
      });

    expect(response.status).toBe(201);

    const auditLog = await findAuditLogByEvent(AuditEventType.PRODUCT_CREATED);

    expect(auditLog).not.toBeNull();
    expect(auditLog?.actorId).toBe(seller.user.id);
    expect(auditLog?.targetId).toBe(response.body.data.id);
    assertNoSensitiveData(auditLog);
    assertNoSensitiveData(response.body);
  });

  it("transaction creation creates TRANSACTION_CREATED", async () => {
    const seller = await createUser({ role: UserRole.SELLER });
    const buyer = await createUserSession({ role: UserRole.BUYER });
    const product = await createProduct({ sellerId: seller.id });

    const response = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({ productId: product.id });

    expect(response.status).toBe(201);

    const auditLog = await findAuditLogByEvent(AuditEventType.TRANSACTION_CREATED);

    expect(auditLog).not.toBeNull();
    expect(auditLog?.actorId).toBe(buyer.user.id);
    expect(auditLog?.targetId).toBe(response.body.data.id);
    assertNoSensitiveData(auditLog);
    assertNoSensitiveData(response.body);
  });

  it("receipt confirmation creates FUNDS_RELEASED", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });
    const buyer = await createUserSession({ role: UserRole.BUYER });
    const product = await createProduct({
      sellerId: seller.user.id,
      status: ProductStatus.RESERVED,
    });
    const transaction = await createTransaction({
      buyerId: buyer.user.id,
      sellerId: seller.user.id,
      productId: product.id,
      productName: product.name,
      agreedPrice: product.price,
      status: TransactionStatus.SHIPPED,
    });

    const response = await request(app)
      .patch(`/api/transactions/${transaction.id}/confirm-receipt`)
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(response.status).toBe(200);

    const auditLog = await findAuditLogByEvent(AuditEventType.FUNDS_RELEASED);

    expect(auditLog).not.toBeNull();
    expect(auditLog?.actorId).toBe(buyer.user.id);
    expect(auditLog?.targetId).toBe(transaction.id);
    assertNoSensitiveData(auditLog);
    assertNoSensitiveData(response.body);
  });

  it("dispute opening creates DISPUTE_OPENED", async () => {
    const seller = await createUser({ role: UserRole.SELLER });
    const buyer = await createUserSession({ role: UserRole.BUYER });
    const product = await createProduct({
      sellerId: seller.id,
      status: ProductStatus.RESERVED,
    });
    const transaction = await createTransaction({
      buyerId: buyer.user.id,
      sellerId: seller.id,
      productId: product.id,
      productName: product.name,
      agreedPrice: product.price,
      status: TransactionStatus.SHIPPED,
    });

    const response = await request(app)
      .post("/api/disputes")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({
        transactionId: transaction.id,
        reason: "ITEM_NOT_RECEIVED",
        description: "The seller marked it shipped but it has not arrived.",
      });

    expect(response.status).toBe(201);

    const auditLog = await findAuditLogByEvent(AuditEventType.DISPUTE_OPENED);

    expect(auditLog).not.toBeNull();
    expect(auditLog?.actorId).toBe(buyer.user.id);
    assertNoSensitiveData(auditLog);
    assertNoSensitiveData(response.body);
  });

  it("admin review creates DISPUTE_REVIEW_STARTED", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });
    const seller = await createUser({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
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
    const dispute = await prisma.dispute.create({
      data: {
        transactionId: transaction.id,
        raisedById: buyer.id,
        reason: "ITEM_NOT_RECEIVED",
        description: "Needs admin review",
        status: "OPEN",
        previousTransactionStatus: TransactionStatus.SHIPPED,
      },
    });

    const response = await request(app)
      .patch(`/api/disputes/${dispute.id}/review`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);

    const auditLog = await findAuditLogByEvent(AuditEventType.DISPUTE_REVIEW_STARTED);

    expect(auditLog).not.toBeNull();
    expect(auditLog?.actorId).toBe(admin.user.id);
    expect(auditLog?.targetId).toBe(dispute.id);
    assertNoSensitiveData(auditLog);
    assertNoSensitiveData(response.body);
  });

  it("refund creates DISPUTE_REFUNDED", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });
    const seller = await createUser({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
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
    const dispute = await prisma.dispute.create({
      data: {
        transactionId: transaction.id,
        raisedById: buyer.id,
        reason: "ITEM_NOT_RECEIVED",
        description: "Refund should be audited",
        status: "UNDER_REVIEW",
        previousTransactionStatus: TransactionStatus.SHIPPED,
      },
    });

    const response = await request(app)
      .patch(`/api/disputes/${dispute.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        decision: "REFUND_BUYER",
        adminNote: "Refund approved after review.",
      });

    expect(response.status).toBe(200);

    const auditLog = await findAuditLogByEvent(AuditEventType.DISPUTE_REFUNDED);

    expect(auditLog).not.toBeNull();
    expect(auditLog?.actorId).toBe(admin.user.id);
    expect(auditLog?.targetId).toBe(dispute.id);
    assertNoSensitiveData(auditLog);
    assertNoSensitiveData(response.body);
  });

  it("seller release creates DISPUTE_RELEASED_TO_SELLER", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });
    const seller = await createUser({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
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
    const dispute = await prisma.dispute.create({
      data: {
        transactionId: transaction.id,
        raisedById: buyer.id,
        reason: "ITEM_NOT_AS_DESCRIBED",
        description: "Release to seller should be audited",
        status: "UNDER_REVIEW",
        previousTransactionStatus: TransactionStatus.SHIPPED,
      },
    });

    const response = await request(app)
      .patch(`/api/disputes/${dispute.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        decision: "RELEASE_SELLER",
        adminNote: "Evidence supports the seller.",
      });

    expect(response.status).toBe(200);

    const auditLog = await findAuditLogByEvent(AuditEventType.DISPUTE_RELEASED_TO_SELLER);

    expect(auditLog).not.toBeNull();
    expect(auditLog?.actorId).toBe(admin.user.id);
    expect(auditLog?.targetId).toBe(dispute.id);
    assertNoSensitiveData(auditLog);
    assertNoSensitiveData(response.body);
  });

  it("rejection creates DISPUTE_REJECTED", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });
    const seller = await createUser({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
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
    const dispute = await prisma.dispute.create({
      data: {
        transactionId: transaction.id,
        raisedById: buyer.id,
        reason: "OTHER",
        description: "Rejected dispute should be audited",
        status: "UNDER_REVIEW",
        previousTransactionStatus: TransactionStatus.SELLER_ACCEPTED,
      },
    });

    const response = await request(app)
      .patch(`/api/disputes/${dispute.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        decision: "REJECT_DISPUTE",
        adminNote: "The dispute does not meet the evidence threshold.",
      });

    expect(response.status).toBe(200);

    const auditLog = await findAuditLogByEvent(AuditEventType.DISPUTE_REJECTED);

    expect(auditLog).not.toBeNull();
    expect(auditLog?.actorId).toBe(admin.user.id);
    expect(auditLog?.targetId).toBe(dispute.id);
    assertNoSensitiveData(auditLog);
    assertNoSensitiveData(response.body);
  });

  it("buyer cannot access admin audit logs", async () => {
    const buyer = await createUserSession({ role: UserRole.BUYER });

    const response = await request(app)
      .get(adminAuditPath)
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(response.status).toBe(403);

    const unauthorizedLog = await findAuditLogByEvent(
      AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
    );

    expect(unauthorizedLog).not.toBeNull();
    expect(unauthorizedLog?.actorId).toBe(buyer.user.id);
    assertNoSensitiveData(response.body);
  });

  it("seller cannot access admin audit logs", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });

    const response = await request(app)
      .get(adminAuditPath)
      .set("Authorization", `Bearer ${seller.token}`);

    expect(response.status).toBe(403);

    const unauthorizedLog = await findAuditLogByEvent(
      AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
    );

    expect(unauthorizedLog).not.toBeNull();
    expect(unauthorizedLog?.actorId).toBe(seller.user.id);
    assertNoSensitiveData(response.body);
  });

  it("admin can access audit logs", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });
    await prisma.auditLog.create({
      data: {
        eventType: AuditEventType.LOGIN_SUCCESS,
        actorId: admin.user.id,
        targetType: "User",
        targetId: admin.user.id,
        description: "Seed audit log for admin list access",
      },
    });

    const response = await request(app)
      .get(adminAuditPath)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.pagination).toBeDefined();
    assertNoSensitiveData(response.body);
  });

  it("filters work correctly", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });
    const actor = await createUser();
    await prisma.auditLog.createMany({
      data: [
        {
          eventType: AuditEventType.LOGIN_SUCCESS,
          actorId: actor.id,
          targetType: "User",
          targetId: actor.id,
          description: "Filtered login success",
        },
        {
          eventType: AuditEventType.PRODUCT_CREATED,
          actorId: actor.id,
          targetType: "Product",
          targetId: "product-filter-target",
          description: "Filtered product create",
        },
      ],
    });

    const response = await request(app)
      .get(`${adminAuditPath}?eventType=PRODUCT_CREATED&targetType=Product&targetId=product-filter-target&actorId=${actor.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].eventType).toBe("PRODUCT_CREATED");
    expect(response.body.data[0].targetId).toBe("product-filter-target");
    assertNoSensitiveData(response.body);
  });

  it("pagination limit is enforced", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });

    await prisma.auditLog.createMany({
      data: Array.from({ length: 3 }, (_, index) => ({
        eventType: AuditEventType.LOGIN_SUCCESS,
        actorId: admin.user.id,
        targetType: "User",
        targetId: `${admin.user.id}-${index}`,
        description: `Pagination audit log ${index}`,
      })),
    });

    const response = await request(app)
      .get(`${adminAuditPath}?page=1&limit=2`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.pagination.limit).toBe(2);
    assertNoSensitiveData(response.body);
  });

  it("audit detail endpoint returns one log", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });
    const auditLog = await prisma.auditLog.create({
      data: {
        eventType: AuditEventType.LOGIN_SUCCESS,
        actorId: admin.user.id,
        targetType: "User",
        targetId: admin.user.id,
        description: "Detail endpoint audit log",
      },
    });

    const response = await request(app)
      .get(`${adminAuditPath}/${auditLog.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(auditLog.id);
    expect(response.body.data.eventType).toBe("LOGIN_SUCCESS");
    assertNoSensitiveData(response.body);
  });

  it("nonexistent audit log returns 404", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });

    const response = await request(app)
      .get(`${adminAuditPath}/non-existent-audit-log`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(404);
    assertNoSensitiveData(response.body);
  });
});

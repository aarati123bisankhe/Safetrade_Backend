import request from "supertest";
import {
  DisputeReason,
  DisputeStatus,
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

describe("Dispute API", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  it("buyer opens a valid dispute", async () => {
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
        description: "The seller marked it as shipped, but it never arrived.",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("OPEN");
    expect(response.body.data.transaction.status).toBe("DISPUTED");
    expect(response.body.data.previousTransactionStatus).toBe("SHIPPED");
  });

  it("seller cannot open buyer-only dispute", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
    const product = await createProduct({
      sellerId: seller.user.id,
      status: ProductStatus.RESERVED,
    });
    const transaction = await createTransaction({
      buyerId: buyer.id,
      sellerId: seller.user.id,
      productId: product.id,
      productName: product.name,
      agreedPrice: product.price,
      status: TransactionStatus.SHIPPED,
    });

    const response = await request(app)
      .post("/api/disputes")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({
        transactionId: transaction.id,
        reason: "ITEM_NOT_RECEIVED",
        description: "I should not be allowed to raise this dispute.",
      });

    expect(response.status).toBe(403);
  });

  it("unrelated user cannot open dispute", async () => {
    const seller = await createUser({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
    const unrelated = await createUserSession({ role: UserRole.BUYER });
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
      status: TransactionStatus.SHIPPED,
    });

    const response = await request(app)
      .post("/api/disputes")
      .set("Authorization", `Bearer ${unrelated.token}`)
      .send({
        transactionId: transaction.id,
        reason: "ITEM_NOT_RECEIVED",
        description: "This user is unrelated to the transaction.",
      });

    expect(response.status).toBe(403);
  });

  it("duplicate dispute is blocked", async () => {
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

    await createDispute({
      transactionId: transaction.id,
      raisedById: buyer.user.id,
      previousTransactionStatus: TransactionStatus.SHIPPED,
    });

    const response = await request(app)
      .post("/api/disputes")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({
        transactionId: transaction.id,
        reason: "ITEM_NOT_RECEIVED",
        description: "Trying to open the same dispute again.",
      });

    expect(response.status).toBe(409);
  });

  it("dispute after funds release is blocked", async () => {
    const seller = await createUser({ role: UserRole.SELLER });
    const buyer = await createUserSession({ role: UserRole.BUYER });
    const product = await createProduct({
      sellerId: seller.id,
      status: ProductStatus.SOLD,
    });
    const transaction = await createTransaction({
      buyerId: buyer.user.id,
      sellerId: seller.id,
      productId: product.id,
      productName: product.name,
      agreedPrice: product.price,
      status: TransactionStatus.FUNDS_RELEASED,
    });

    const response = await request(app)
      .post("/api/disputes")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({
        transactionId: transaction.id,
        reason: "ITEM_NOT_RECEIVED",
        description: "Too late to open a dispute now.",
      });

    expect(response.status).toBe(409);
  });

  it("transaction becomes DISPUTED", async () => {
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
      status: TransactionStatus.SELLER_ACCEPTED,
    });

    const response = await request(app)
      .post("/api/disputes")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({
        transactionId: transaction.id,
        reason: "ITEM_NOT_AS_DESCRIBED",
        description: "The item condition does not match the listing.",
      });

    expect(response.status).toBe(201);

    const updatedTransaction = await prisma.tradeTransaction.findUniqueOrThrow({
      where: { id: transaction.id },
    });

    expect(updatedTransaction.status).toBe(TransactionStatus.DISPUTED);
  });

  it("buyer and seller can view the dispute", async () => {
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
      status: TransactionStatus.DISPUTED,
    });
    const dispute = await createDispute({
      transactionId: transaction.id,
      raisedById: buyer.user.id,
      previousTransactionStatus: TransactionStatus.SHIPPED,
    });

    const buyerResponse = await request(app)
      .get(`/api/disputes/${dispute.id}`)
      .set("Authorization", `Bearer ${buyer.token}`);
    const sellerResponse = await request(app)
      .get(`/api/disputes/${dispute.id}`)
      .set("Authorization", `Bearer ${seller.token}`);

    expect(buyerResponse.status).toBe(200);
    expect(sellerResponse.status).toBe(200);
    expect(buyerResponse.body.data.raisedBy.password).toBeUndefined();
  });

  it("unrelated user is blocked from viewing", async () => {
    const seller = await createUser({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
    const unrelated = await createUserSession({ role: UserRole.BUYER });
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
    const dispute = await createDispute({
      transactionId: transaction.id,
      raisedById: buyer.id,
    });

    const response = await request(app)
      .get(`/api/disputes/${dispute.id}`)
      .set("Authorization", `Bearer ${unrelated.token}`);

    expect(response.status).toBe(403);
  });

  it("admin marks dispute under review", async () => {
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
    const dispute = await createDispute({
      transactionId: transaction.id,
      raisedById: buyer.id,
      status: DisputeStatus.OPEN,
    });

    const response = await request(app)
      .patch(`/api/disputes/${dispute.id}/review`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("UNDER_REVIEW");
  });

  it("non-admin cannot review dispute", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
    const product = await createProduct({
      sellerId: seller.user.id,
      status: ProductStatus.RESERVED,
    });
    const transaction = await createTransaction({
      buyerId: buyer.id,
      sellerId: seller.user.id,
      productId: product.id,
      productName: product.name,
      agreedPrice: product.price,
      status: TransactionStatus.DISPUTED,
    });
    const dispute = await createDispute({
      transactionId: transaction.id,
      raisedById: buyer.id,
      status: DisputeStatus.OPEN,
    });

    const response = await request(app)
      .patch(`/api/disputes/${dispute.id}/review`)
      .set("Authorization", `Bearer ${seller.token}`);

    expect(response.status).toBe(403);
  });

  it("admin refunds buyer", async () => {
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
    const dispute = await createDispute({
      transactionId: transaction.id,
      raisedById: buyer.id,
      previousTransactionStatus: TransactionStatus.SHIPPED,
      status: DisputeStatus.UNDER_REVIEW,
    });

    const response = await request(app)
      .patch(`/api/disputes/${dispute.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        decision: "REFUND_BUYER",
        adminNote: "Evidence shows the item was not delivered.",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("RESOLVED_BUYER");
    expect(response.body.data.transaction.status).toBe("BUYER_REFUNDED");
  });

  it("refund restores product to AVAILABLE", async () => {
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
    const dispute = await createDispute({
      transactionId: transaction.id,
      raisedById: buyer.id,
      status: DisputeStatus.UNDER_REVIEW,
    });

    await request(app)
      .patch(`/api/disputes/${dispute.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        decision: "REFUND_BUYER",
        adminNote: "Refund approved due to strong buyer evidence.",
      });

    const updatedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });

    expect(updatedProduct.status).toBe(ProductStatus.AVAILABLE);
  });

  it("admin releases funds to seller", async () => {
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
    const dispute = await createDispute({
      transactionId: transaction.id,
      raisedById: buyer.id,
      previousTransactionStatus: TransactionStatus.SHIPPED,
      status: DisputeStatus.UNDER_REVIEW,
    });

    const response = await request(app)
      .patch(`/api/disputes/${dispute.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        decision: "RELEASE_SELLER",
        adminNote: "Seller evidence is stronger; release funds.",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("RESOLVED_SELLER");
    expect(response.body.data.transaction.status).toBe("FUNDS_RELEASED");
  });

  it("release marks product SOLD", async () => {
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
    const dispute = await createDispute({
      transactionId: transaction.id,
      raisedById: buyer.id,
      status: DisputeStatus.UNDER_REVIEW,
    });

    await request(app)
      .patch(`/api/disputes/${dispute.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        decision: "RELEASE_SELLER",
        adminNote: "The seller should receive the held funds.",
      });

    const updatedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });

    expect(updatedProduct.status).toBe(ProductStatus.SOLD);
  });

  it("duplicate resolution is blocked", async () => {
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
    const dispute = await createDispute({
      transactionId: transaction.id,
      raisedById: buyer.id,
      status: DisputeStatus.UNDER_REVIEW,
    });

    const firstResponse = await request(app)
      .patch(`/api/disputes/${dispute.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        decision: "REFUND_BUYER",
        adminNote: "Refunding after review.",
      });

    expect(firstResponse.status).toBe(200);

    const secondResponse = await request(app)
      .patch(`/api/disputes/${dispute.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        decision: "RELEASE_SELLER",
        adminNote: "Trying to resolve again should fail.",
      });

    expect(secondResponse.status).toBe(409);
  });

  it("resolution before review is blocked", async () => {
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
    const dispute = await createDispute({
      transactionId: transaction.id,
      raisedById: buyer.id,
      status: DisputeStatus.OPEN,
    });

    const response = await request(app)
      .patch(`/api/disputes/${dispute.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        decision: "REFUND_BUYER",
        adminNote: "This should fail before review.",
      });

    expect(response.status).toBe(409);
  });

  it("resolved dispute cannot be modified", async () => {
    const admin = await createUserSession({ role: UserRole.ADMIN });
    const seller = await createUser({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
    const product = await createProduct({
      sellerId: seller.id,
      status: ProductStatus.AVAILABLE,
    });
    const transaction = await createTransaction({
      buyerId: buyer.id,
      sellerId: seller.id,
      productId: product.id,
      productName: product.name,
      agreedPrice: product.price,
      status: TransactionStatus.BUYER_REFUNDED,
    });
    const dispute = await createDispute({
      transactionId: transaction.id,
      raisedById: buyer.id,
      status: DisputeStatus.RESOLVED_BUYER,
      resolvedById: admin.user.id,
      adminNote: "Already resolved.",
      resolvedAt: new Date(),
    });

    const reviewResponse = await request(app)
      .patch(`/api/disputes/${dispute.id}/review`)
      .set("Authorization", `Bearer ${admin.token}`);
    const resolveResponse = await request(app)
      .patch(`/api/disputes/${dispute.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        decision: "RELEASE_SELLER",
        adminNote: "Trying to modify a resolved dispute.",
      });

    expect(reviewResponse.status).toBe(409);
    expect(resolveResponse.status).toBe(409);
  });

  it("rejecting a dispute restores the previous transaction state", async () => {
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
    const dispute = await createDispute({
      transactionId: transaction.id,
      raisedById: buyer.id,
      previousTransactionStatus: TransactionStatus.SELLER_ACCEPTED,
      status: DisputeStatus.UNDER_REVIEW,
      reason: DisputeReason.OTHER,
    });

    const response = await request(app)
      .patch(`/api/disputes/${dispute.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        decision: "REJECT_DISPUTE",
        adminNote: "The dispute evidence was insufficient.",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("REJECTED");
    expect(response.body.data.transaction.status).toBe("SELLER_ACCEPTED");
  });
});

import jwt from "jsonwebtoken";
import request from "supertest";
import { ProductStatus, TransactionStatus, UserRole } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/configs/database.config";
import {
  clearDatabase,
  createProduct,
  createUser,
  createUserSession,
} from "../helpers/test-data";

describe("Transaction API", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
    await prisma.$disconnect();
  });

  it("creates a transaction and reserves the product", async () => {
    const { user: seller, token: sellerToken } = await createUserSession({
      role: UserRole.SELLER,
    });
    const { token: buyerToken } = await createUserSession({
      role: UserRole.BUYER,
    });

    const createProductResponse = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({
        name: "Gaming Laptop",
        description: "A powerful gaming laptop in great condition",
        price: 1200,
        category: "ELECTRONICS",
        condition: "GOOD",
        location: "Kathmandu",
      });

    expect(createProductResponse.status).toBe(201);

    const productId = createProductResponse.body.data.id as string;

    const transactionResponse = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ productId });

    expect(transactionResponse.status).toBe(201);
    expect(transactionResponse.body.data.status).toBe("FUNDS_HELD");

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });

    expect(product.status).toBe(ProductStatus.RESERVED);
    expect(transactionResponse.body.data.sellerId).toBe(seller.id);
  });

  it("prevents a seller from buying their own product", async () => {
    const { user: seller, token } = await createUserSession({
      role: UserRole.SELLER,
    });
    const product = await createProduct({ sellerId: seller.id });

    const response = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: product.id });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("prevents two buyers from reserving the same product", async () => {
    const seller = await createUser({ role: UserRole.SELLER });
    const buyerOne = await createUserSession({ role: UserRole.BUYER });
    const buyerTwo = await createUserSession({ role: UserRole.BUYER });
    const product = await createProduct({ sellerId: seller.id });

    const results = await Promise.allSettled([
      request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${buyerOne.token}`)
        .send({ productId: product.id }),
      request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${buyerTwo.token}`)
        .send({ productId: product.id }),
    ]);

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<request.Response> =>
        result.status === "fulfilled",
    );

    expect(fulfilled).toHaveLength(2);

    const statuses = fulfilled.map((result) => result.value.status).sort();
    expect(statuses).toEqual([201, 409]);

    const count = await prisma.tradeTransaction.count({
      where: { productId: product.id },
    });
    const updatedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });

    expect(count).toBe(1);
    expect(updatedProduct.status).toBe(ProductStatus.RESERVED);
  });

  it("allows the buyer to view their purchase", async () => {
    const seller = await createUser({ role: UserRole.SELLER });
    const buyer = await createUserSession({ role: UserRole.BUYER });
    const product = await createProduct({ sellerId: seller.id });
    const transaction = await prisma.tradeTransaction.create({
      data: {
        buyerId: buyer.user.id,
        sellerId: seller.id,
        productId: product.id,
        productName: product.name,
        agreedPrice: product.price,
        status: TransactionStatus.FUNDS_HELD,
      },
    });

    const response = await request(app)
      .get("/api/transactions/my-purchases")
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(transaction.id);
    expect(response.body.data[0].seller.password).toBeUndefined();
  });

  it("allows the seller to view their sale", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
    const product = await createProduct({ sellerId: seller.user.id });
    const transaction = await prisma.tradeTransaction.create({
      data: {
        buyerId: buyer.id,
        sellerId: seller.user.id,
        productId: product.id,
        productName: product.name,
        agreedPrice: product.price,
        status: TransactionStatus.FUNDS_HELD,
      },
    });

    const response = await request(app)
      .get("/api/transactions/my-sales")
      .set("Authorization", `Bearer ${seller.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(transaction.id);
    expect(response.body.data[0].buyer.password).toBeUndefined();
  });

  it("blocks unrelated users from viewing the transaction", async () => {
    const seller = await createUser({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
    const unrelated = await createUserSession({ role: UserRole.BUYER });
    const product = await createProduct({ sellerId: seller.id });
    const transaction = await prisma.tradeTransaction.create({
      data: {
        buyerId: buyer.id,
        sellerId: seller.id,
        productId: product.id,
        productName: product.name,
        agreedPrice: product.price,
        status: TransactionStatus.FUNDS_HELD,
      },
    });

    const response = await request(app)
      .get(`/api/transactions/${transaction.id}`)
      .set("Authorization", `Bearer ${unrelated.token}`);

    expect(response.status).toBe(403);
  });

  it("returns 404 for a transaction that does not exist", async () => {
    const buyer = await createUserSession({ role: UserRole.BUYER });

    const response = await request(app)
      .get("/api/transactions/non-existent-transaction-id")
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(response.status).toBe(404);
  });

  it("allows the seller to accept held funds", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
    const product = await createProduct({
      sellerId: seller.user.id,
      status: ProductStatus.RESERVED,
    });
    const transaction = await prisma.tradeTransaction.create({
      data: {
        buyerId: buyer.id,
        sellerId: seller.user.id,
        productId: product.id,
        productName: product.name,
        agreedPrice: product.price,
        status: TransactionStatus.FUNDS_HELD,
      },
    });

    const response = await request(app)
      .patch(`/api/transactions/${transaction.id}/accept`)
      .set("Authorization", `Bearer ${seller.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("SELLER_ACCEPTED");
  });

  it("blocks acceptance from an invalid state", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
    const product = await createProduct({
      sellerId: seller.user.id,
      status: ProductStatus.RESERVED,
    });
    const transaction = await prisma.tradeTransaction.create({
      data: {
        buyerId: buyer.id,
        sellerId: seller.user.id,
        productId: product.id,
        productName: product.name,
        agreedPrice: product.price,
        status: TransactionStatus.SELLER_ACCEPTED,
      },
    });

    const response = await request(app)
      .patch(`/api/transactions/${transaction.id}/accept`)
      .set("Authorization", `Bearer ${seller.token}`);

    expect(response.status).toBe(409);
  });

  it("allows the seller to mark an accepted order as shipped", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
    const product = await createProduct({
      sellerId: seller.user.id,
      status: ProductStatus.RESERVED,
    });
    const transaction = await prisma.tradeTransaction.create({
      data: {
        buyerId: buyer.id,
        sellerId: seller.user.id,
        productId: product.id,
        productName: product.name,
        agreedPrice: product.price,
        status: TransactionStatus.SELLER_ACCEPTED,
      },
    });

    const response = await request(app)
      .patch(`/api/transactions/${transaction.id}/ship`)
      .set("Authorization", `Bearer ${seller.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("SHIPPED");
  });

  it("blocks shipping before acceptance", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
    const product = await createProduct({
      sellerId: seller.user.id,
      status: ProductStatus.RESERVED,
    });
    const transaction = await prisma.tradeTransaction.create({
      data: {
        buyerId: buyer.id,
        sellerId: seller.user.id,
        productId: product.id,
        productName: product.name,
        agreedPrice: product.price,
        status: TransactionStatus.FUNDS_HELD,
      },
    });

    const response = await request(app)
      .patch(`/api/transactions/${transaction.id}/ship`)
      .set("Authorization", `Bearer ${seller.token}`);

    expect(response.status).toBe(409);
  });

  it("allows the buyer to confirm receipt", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });
    const buyer = await createUserSession({ role: UserRole.BUYER });
    const product = await createProduct({
      sellerId: seller.user.id,
      status: ProductStatus.RESERVED,
    });
    const transaction = await prisma.tradeTransaction.create({
      data: {
        buyerId: buyer.user.id,
        sellerId: seller.user.id,
        productId: product.id,
        productName: product.name,
        agreedPrice: product.price,
        status: TransactionStatus.SHIPPED,
      },
    });

    const response = await request(app)
      .patch(`/api/transactions/${transaction.id}/confirm-receipt`)
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("FUNDS_RELEASED");
    expect(response.body.data.buyerConfirmedAt).not.toBeNull();
    expect(response.body.data.releasedAt).not.toBeNull();
    expect(response.body.data.product.status).toBe("SOLD");
  });

  it("releases funds and marks the product sold", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });
    const buyer = await createUserSession({ role: UserRole.BUYER });

    const createProductResponse = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({
        name: "Phone",
        description: "A clean and working smartphone for sale",
        price: 500,
        category: "ELECTRONICS",
        condition: "GOOD",
        location: "Pokhara",
      });

    const productId = createProductResponse.body.data.id as string;

    const createTransactionResponse = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({ productId });

    const transactionId = createTransactionResponse.body.data.id as string;

    const acceptResponse = await request(app)
      .patch(`/api/transactions/${transactionId}/accept`)
      .set("Authorization", `Bearer ${seller.token}`);
    const shipResponse = await request(app)
      .patch(`/api/transactions/${transactionId}/ship`)
      .set("Authorization", `Bearer ${seller.token}`);
    const confirmResponse = await request(app)
      .patch(`/api/transactions/${transactionId}/confirm-receipt`)
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(acceptResponse.status).toBe(200);
    expect(shipResponse.status).toBe(200);
    expect(confirmResponse.status).toBe(200);

    const transaction = await prisma.tradeTransaction.findUniqueOrThrow({
      where: { id: transactionId },
    });
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });

    expect(transaction.status).toBe(TransactionStatus.FUNDS_RELEASED);
    expect(transaction.buyerConfirmedAt).not.toBeNull();
    expect(transaction.releasedAt).not.toBeNull();
    expect(product.status).toBe(ProductStatus.SOLD);
  });

  it("blocks duplicate receipt confirmation", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });
    const buyer = await createUserSession({ role: UserRole.BUYER });
    const product = await createProduct({
      sellerId: seller.user.id,
      status: ProductStatus.RESERVED,
    });
    const transaction = await prisma.tradeTransaction.create({
      data: {
        buyerId: buyer.user.id,
        sellerId: seller.user.id,
        productId: product.id,
        productName: product.name,
        agreedPrice: product.price,
        status: TransactionStatus.SHIPPED,
      },
    });

    const firstResponse = await request(app)
      .patch(`/api/transactions/${transaction.id}/confirm-receipt`)
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(firstResponse.status).toBe(200);

    const firstSaved = await prisma.tradeTransaction.findUniqueOrThrow({
      where: { id: transaction.id },
    });

    const secondResponse = await request(app)
      .patch(`/api/transactions/${transaction.id}/confirm-receipt`)
      .set("Authorization", `Bearer ${buyer.token}`);

    const secondSaved = await prisma.tradeTransaction.findUniqueOrThrow({
      where: { id: transaction.id },
    });
    const soldProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });

    expect(secondResponse.status).toBe(409);
    expect(secondSaved.releasedAt?.toISOString()).toBe(
      firstSaved.releasedAt?.toISOString(),
    );
    expect(secondSaved.status).toBe(TransactionStatus.FUNDS_RELEASED);
    expect(soldProduct.status).toBe(ProductStatus.SOLD);
  });

  it("blocks the seller from confirming receipt", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
    const product = await createProduct({
      sellerId: seller.user.id,
      status: ProductStatus.RESERVED,
    });
    const transaction = await prisma.tradeTransaction.create({
      data: {
        buyerId: buyer.id,
        sellerId: seller.user.id,
        productId: product.id,
        productName: product.name,
        agreedPrice: product.price,
        status: TransactionStatus.SHIPPED,
      },
    });

    const response = await request(app)
      .patch(`/api/transactions/${transaction.id}/confirm-receipt`)
      .set("Authorization", `Bearer ${seller.token}`);

    expect(response.status).toBe(403);
  });

  it("blocks invalid ownership for seller actions", async () => {
    const seller = await createUser({ role: UserRole.SELLER });
    const otherSeller = await createUserSession({ role: UserRole.SELLER });
    const buyer = await createUser({ role: UserRole.BUYER });
    const product = await createProduct({
      sellerId: seller.id,
      status: ProductStatus.RESERVED,
    });
    const transaction = await prisma.tradeTransaction.create({
      data: {
        buyerId: buyer.id,
        sellerId: seller.id,
        productId: product.id,
        productName: product.name,
        agreedPrice: product.price,
        status: TransactionStatus.FUNDS_HELD,
      },
    });

    const acceptResponse = await request(app)
      .patch(`/api/transactions/${transaction.id}/accept`)
      .set("Authorization", `Bearer ${otherSeller.token}`);

    expect(acceptResponse.status).toBe(403);

    await prisma.tradeTransaction.update({
      where: { id: transaction.id },
      data: { status: TransactionStatus.SELLER_ACCEPTED },
    });

    const shipResponse = await request(app)
      .patch(`/api/transactions/${transaction.id}/ship`)
      .set("Authorization", `Bearer ${otherSeller.token}`);

    expect(shipResponse.status).toBe(403);
  });

  it("returns 409 for unavailable products", async () => {
    const seller = await createUser({ role: UserRole.SELLER });
    const buyer = await createUserSession({ role: UserRole.BUYER });

    for (const status of [
      ProductStatus.RESERVED,
      ProductStatus.SOLD,
      ProductStatus.REMOVED,
    ]) {
      const product = await createProduct({
        sellerId: seller.id,
        status,
      });

      const response = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({ productId: product.id });

      expect(response.status).toBe(409);
    }
  });

  it("returns 401 for missing, invalid, and expired authentication", async () => {
    const buyer = await createUser({ role: UserRole.BUYER });
    const invalidToken = "not-a-real-token";
    const expiredToken = jwt.sign(
      { userId: buyer.id },
      process.env.JWT_SECRET ?? "test-secret",
      { expiresIn: "-1s" },
    );

    const missingTokenResponse = await request(app).get(
      "/api/transactions/my-purchases",
    );
    const invalidTokenResponse = await request(app)
      .get("/api/transactions/my-purchases")
      .set("Authorization", `Bearer ${invalidToken}`);
    const expiredTokenResponse = await request(app)
      .get("/api/transactions/my-purchases")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(missingTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(expiredTokenResponse.status).toBe(401);
  });

  it("returns 403 for authenticated but unauthorized role access", async () => {
    const seller = await createUserSession({ role: UserRole.SELLER });
    const buyer = await createUserSession({ role: UserRole.BUYER });
    const product = await createProduct({
      sellerId: seller.user.id,
      status: ProductStatus.RESERVED,
    });
    const transaction = await prisma.tradeTransaction.create({
      data: {
        buyerId: buyer.user.id,
        sellerId: seller.user.id,
        productId: product.id,
        productName: product.name,
        agreedPrice: product.price,
        status: TransactionStatus.FUNDS_HELD,
      },
    });

    const buyerAcceptResponse = await request(app)
      .patch(`/api/transactions/${transaction.id}/accept`)
      .set("Authorization", `Bearer ${buyer.token}`);
    const sellerConfirmResponse = await request(app)
      .patch(`/api/transactions/${transaction.id}/confirm-receipt`)
      .set("Authorization", `Bearer ${seller.token}`);

    expect(buyerAcceptResponse.status).toBe(403);
    expect(sellerConfirmResponse.status).toBe(403);
  });
});

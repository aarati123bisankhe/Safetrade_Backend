import fs from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { DisputeStatus, ProductStatus, TransactionStatus, UserRole } from "@prisma/client";
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

const pngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sX8s6sAAAAASUVORK5CYII=",
  "base64",
);

const pdfBuffer = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF",
  "utf8",
);

const textBuffer = Buffer.from("this is not a real image", "utf8");
const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1, "a");
const storageDir = path.resolve(process.cwd(), "storage/dispute-evidence");

const uploadEvidence = (
  token: string,
  disputeId: string,
  buffer: Buffer,
  filename: string,
  contentType: string,
) =>
  request(app)
    .post(`/api/disputes/${disputeId}/evidence`)
    .set("Authorization", `Bearer ${token}`)
    .attach("file", buffer, { filename, contentType });

const createEvidenceFixture = async ({
  disputeStatus = DisputeStatus.OPEN,
}: {
  disputeStatus?: DisputeStatus;
} = {}) => {
  const seller = await createUserSession({ role: UserRole.SELLER });
  const buyer = await createUserSession({ role: UserRole.BUYER });
  const admin = await createUserSession({ role: UserRole.ADMIN });
  const unrelated = await createUserSession({ role: UserRole.BUYER });
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
    status: disputeStatus,
  });

  return {
    seller,
    buyer,
    admin,
    unrelated,
    product,
    transaction,
    dispute,
  };
};

describe("Dispute Evidence API", () => {
  beforeEach(async () => {
    await clearDatabase();
    await fs.rm(storageDir, { recursive: true, force: true });
    await fs.mkdir(storageDir, { recursive: true });
  });

  afterAll(async () => {
    await clearDatabase();
    await fs.rm(storageDir, { recursive: true, force: true });
    await fs.mkdir(storageDir, { recursive: true });
  });

  it("buyer uploads valid PNG", async () => {
    const { buyer, dispute } = await createEvidenceFixture();

    const response = await uploadEvidence(
      buyer.token,
      dispute.id,
      pngBuffer,
      "delivery-photo.png",
      "image/png",
    );

    expect(response.status).toBe(201);
    expect(response.body.data.originalName).toBe("delivery-photo.png");
    expect(response.body.data.mimeType).toBe("image/png");
    expect(response.body.data.storagePath).toBeUndefined();

    const storedEvidence = await prisma.disputeEvidence.findUniqueOrThrow({
      where: { id: response.body.data.id },
    });

    expect(storedEvidence.storedName).toMatch(/^[0-9a-f-]+\.png$/);
    expect(storedEvidence.storagePath).toContain("storage/dispute-evidence/");
    expect(storedEvidence.sha256Hash).toHaveLength(64);
  });

  it("seller uploads valid PDF", async () => {
    const { seller, dispute } = await createEvidenceFixture();

    const response = await uploadEvidence(
      seller.token,
      dispute.id,
      pdfBuffer,
      "invoice.pdf",
      "application/pdf",
    );

    expect(response.status).toBe(201);
    expect(response.body.data.mimeType).toBe("application/pdf");
    expect(response.body.data.sizeBytes).toBe(pdfBuffer.length);
  });

  it("admin can view evidence", async () => {
    const { buyer, admin, dispute } = await createEvidenceFixture();
    const uploadResponse = await uploadEvidence(
      buyer.token,
      dispute.id,
      pngBuffer,
      "photo.png",
      "image/png",
    );

    const response = await request(app)
      .get(`/api/disputes/${dispute.id}/evidence/${uploadResponse.body.data.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("image/png");
    expect(response.headers["content-disposition"]).toContain("attachment;");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("buyer and seller can list evidence", async () => {
    const { buyer, seller, dispute } = await createEvidenceFixture();
    await uploadEvidence(
      buyer.token,
      dispute.id,
      pngBuffer,
      "buyer-photo.png",
      "image/png",
    );
    await uploadEvidence(
      seller.token,
      dispute.id,
      pdfBuffer,
      "seller-doc.pdf",
      "application/pdf",
    );

    const buyerResponse = await request(app)
      .get(`/api/disputes/${dispute.id}/evidence`)
      .set("Authorization", `Bearer ${buyer.token}`);
    const sellerResponse = await request(app)
      .get(`/api/disputes/${dispute.id}/evidence`)
      .set("Authorization", `Bearer ${seller.token}`);

    expect(buyerResponse.status).toBe(200);
    expect(sellerResponse.status).toBe(200);
    expect(buyerResponse.body.data).toHaveLength(2);
    expect(sellerResponse.body.data).toHaveLength(2);
    expect(JSON.stringify(buyerResponse.body)).not.toContain("storagePath");
  });

  it("unrelated user receives 403", async () => {
    const { unrelated, dispute } = await createEvidenceFixture();

    const response = await uploadEvidence(
      unrelated.token,
      dispute.id,
      pngBuffer,
      "proof.png",
      "image/png",
    );

    expect(response.status).toBe(403);
  });

  it("unauthenticated user receives 401", async () => {
    const { dispute } = await createEvidenceFixture();

    const response = await request(app)
      .post(`/api/disputes/${dispute.id}/evidence`)
      .attach("file", pngBuffer, { filename: "proof.png", contentType: "image/png" });

    expect(response.status).toBe(401);
  });

  it("upload to missing dispute returns 404", async () => {
    const buyer = await createUserSession({ role: UserRole.BUYER });

    const response = await uploadEvidence(
      buyer.token,
      "missing-dispute-id",
      pngBuffer,
      "proof.png",
      "image/png",
    );

    expect(response.status).toBe(404);
  });

  it("upload to resolved dispute returns 409", async () => {
    const { buyer, dispute } = await createEvidenceFixture({
      disputeStatus: DisputeStatus.RESOLVED_BUYER,
    });

    const response = await uploadEvidence(
      buyer.token,
      dispute.id,
      pngBuffer,
      "proof.png",
      "image/png",
    );

    expect(response.status).toBe(409);
  });

  it("unsupported MIME type returns 415", async () => {
    const { buyer, dispute } = await createEvidenceFixture();

    const response = await uploadEvidence(
      buyer.token,
      dispute.id,
      textBuffer,
      "notes.txt",
      "text/plain",
    );

    expect(response.status).toBe(415);
  });

  it("fake PNG containing text is rejected", async () => {
    const { buyer, dispute } = await createEvidenceFixture();

    const response = await uploadEvidence(
      buyer.token,
      dispute.id,
      textBuffer,
      "fake.png",
      "image/png",
    );

    expect(response.status).toBe(415);
  });

  it("oversized file is rejected", async () => {
    const { buyer, dispute } = await createEvidenceFixture();

    const response = await uploadEvidence(
      buyer.token,
      dispute.id,
      oversizedBuffer,
      "big-proof.png",
      "image/png",
    );

    expect(response.status).toBe(413);
  });

  it("sixth file is rejected when limit is five", async () => {
    const { buyer, dispute } = await createEvidenceFixture();

    for (let index = 1; index <= 5; index += 1) {
      const response = await uploadEvidence(
        buyer.token,
        dispute.id,
        pngBuffer,
        `proof-${index}.png`,
        "image/png",
      );

      expect(response.status).toBe(201);
    }

    const sixthResponse = await uploadEvidence(
      buyer.token,
      dispute.id,
      pngBuffer,
      "proof-6.png",
      "image/png",
    );

    expect(sixthResponse.status).toBe(409);
  });

  it("stored filename is random", async () => {
    const { buyer, dispute } = await createEvidenceFixture();

    const response = await uploadEvidence(
      buyer.token,
      dispute.id,
      pngBuffer,
      "original-proof.png",
      "image/png",
    );

    const storedEvidence = await prisma.disputeEvidence.findUniqueOrThrow({
      where: { id: response.body.data.id },
    });

    expect(storedEvidence.storedName).not.toBe("original-proof.png");
    expect(storedEvidence.originalName).toBe("original-proof.png");
  });
});

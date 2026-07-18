import mongoose, { Schema, type ClientSession } from "mongoose";
import {
  AuditEventType,
  DisputeReason,
  DisputeStatus,
  OAuthProvider,
  OAuthStateAction,
  ProductCategory,
  ProductCondition,
  ProductStatus,
  TransactionStatus,
  UserRole,
} from "./types";

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.BUYER },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastFailedLoginAt: { type: Date, default: null },
    passwordAuthEnabled: { type: Boolean, default: true },
    totpEnabled: { type: Boolean, default: false },
    totpSecret: { type: String, default: null },
  },
  { timestamps: true },
);

const oauthAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: Object.values(OAuthProvider), required: true },
    providerAccountId: { type: String, required: true },
    providerEmail: { type: String, default: null },
  },
  { timestamps: true },
);
oauthAccountSchema.index({ provider: 1, providerAccountId: 1 }, { unique: true });

const oauthStateSchema = new Schema(
  {
    stateHash: { type: String, required: true, unique: true },
    nonce: { type: String, required: true },
    codeVerifier: { type: String, required: true },
    action: { type: String, enum: Object.values(OAuthStateAction), required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const oauthExchangeCodeSchema = new Schema(
  {
    codeHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, enum: Object.values(OAuthStateAction), required: true },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const recoveryCodeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    codeHash: { type: String, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const loginAttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    email: { type: String, required: true, index: true },
    ipAddress: { type: String, default: null, index: true },
    userAgent: { type: String, default: null },
    successful: { type: Boolean, required: true },
    reason: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: null, trim: true },
    price: { type: Number, required: true },
    category: { type: String, enum: Object.values(ProductCategory), required: true },
    condition: { type: String, enum: Object.values(ProductCondition), required: true },
    status: {
      type: String,
      enum: Object.values(ProductStatus),
      default: ProductStatus.AVAILABLE,
      index: true,
    },
    location: { type: String, required: true, trim: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

const tradeTransactionSchema = new Schema(
  {
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    productName: { type: String, required: true },
    agreedPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING_PAYMENT,
      index: true,
    },
    buyerConfirmedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "transactions" },
);

const disputeSchema = new Schema(
  {
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "TradeTransaction",
      required: true,
      unique: true,
    },
    raisedById: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reason: { type: String, enum: Object.values(DisputeReason), required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(DisputeStatus),
      default: DisputeStatus.OPEN,
      index: true,
    },
    previousTransactionStatus: {
      type: String,
      enum: Object.values(TransactionStatus),
      required: true,
    },
    adminNote: { type: String, default: null },
    resolvedById: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const disputeEvidenceSchema = new Schema(
  {
    disputeId: { type: Schema.Types.ObjectId, ref: "Dispute", required: true, index: true },
    uploadedById: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    storagePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    sha256Hash: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const auditLogSchema = new Schema(
  {
    eventType: { type: String, enum: Object.values(AuditEventType), required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    targetType: { type: String, default: null },
    targetId: { type: String, default: null },
    description: { type: String, required: true },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditLogSchema.index({ targetType: 1, targetId: 1 });

export const UserModel = mongoose.models.User || mongoose.model("User", userSchema);
export const OAuthAccountModel =
  mongoose.models.OAuthAccount || mongoose.model("OAuthAccount", oauthAccountSchema);
export const OAuthStateModel =
  mongoose.models.OAuthState || mongoose.model("OAuthState", oauthStateSchema);
export const OAuthExchangeCodeModel =
  mongoose.models.OAuthExchangeCode ||
  mongoose.model("OAuthExchangeCode", oauthExchangeCodeSchema);
export const RecoveryCodeModel =
  mongoose.models.RecoveryCode || mongoose.model("RecoveryCode", recoveryCodeSchema);
export const LoginAttemptModel =
  mongoose.models.LoginAttempt || mongoose.model("LoginAttempt", loginAttemptSchema);
export const ProductModel =
  mongoose.models.Product || mongoose.model("Product", productSchema);
export const TradeTransactionModel =
  mongoose.models.TradeTransaction ||
  mongoose.model("TradeTransaction", tradeTransactionSchema);
export const DisputeModel =
  mongoose.models.Dispute || mongoose.model("Dispute", disputeSchema);
export const DisputeEvidenceModel =
  mongoose.models.DisputeEvidence ||
  mongoose.model("DisputeEvidence", disputeEvidenceSchema);
export const AuditLogModel =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

export const normalizeMongoDoc = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeMongoDoc(item)) as T;
  }

  if (value instanceof Date) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const valueRecord = value as unknown as Record<string, unknown>;
  const plain = "toObject" in valueRecord
    ? (value as unknown as { toObject: () => Record<string, unknown> }).toObject()
    : { ...(value as Record<string, unknown>) };

  const output: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(plain)) {
    if (key === "__v") {
      continue;
    }

    if (key === "_id") {
      output.id = String(entry);
      continue;
    }

    if (entry instanceof mongoose.Types.ObjectId) {
      output[key] = String(entry);
      continue;
    }

    output[key] = normalizeMongoDoc(entry);
  }

  return output as T;
};

export const publicUserSelect = "username email role createdAt updatedAt";

export type MongoSession = ClientSession;

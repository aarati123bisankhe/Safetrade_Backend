export const UserRole = {
  BUYER: "BUYER",
  SELLER: "SELLER",
  ADMIN: "ADMIN",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ProductCategory = {
  BOOKS: "BOOKS",
  ELECTRONICS: "ELECTRONICS",
  CLOTHING: "CLOTHING",
  FURNITURE: "FURNITURE",
  HANDMADE: "HANDMADE",
  OTHER: "OTHER",
} as const;

export type ProductCategory =
  (typeof ProductCategory)[keyof typeof ProductCategory];

export const ProductCondition = {
  NEW: "NEW",
  LIKE_NEW: "LIKE_NEW",
  GOOD: "GOOD",
  FAIR: "FAIR",
} as const;

export type ProductCondition =
  (typeof ProductCondition)[keyof typeof ProductCondition];

export const ProductStatus = {
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  SOLD: "SOLD",
  REMOVED: "REMOVED",
} as const;

export type ProductStatus =
  (typeof ProductStatus)[keyof typeof ProductStatus];

export const TransactionStatus = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  FUNDS_HELD: "FUNDS_HELD",
  SELLER_ACCEPTED: "SELLER_ACCEPTED",
  SHIPPED: "SHIPPED",
  READY_FOR_COLLECTION: "READY_FOR_COLLECTION",
  BUYER_CONFIRMED: "BUYER_CONFIRMED",
  DISPUTED: "DISPUTED",
  FUNDS_RELEASED: "FUNDS_RELEASED",
  BUYER_REFUNDED: "BUYER_REFUNDED",
  CANCELLED: "CANCELLED",
} as const;

export type TransactionStatus =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const DisputeStatus = {
  OPEN: "OPEN",
  UNDER_REVIEW: "UNDER_REVIEW",
  RESOLVED_BUYER: "RESOLVED_BUYER",
  RESOLVED_SELLER: "RESOLVED_SELLER",
  REJECTED: "REJECTED",
} as const;

export type DisputeStatus =
  (typeof DisputeStatus)[keyof typeof DisputeStatus];

export const DisputeReason = {
  ITEM_NOT_RECEIVED: "ITEM_NOT_RECEIVED",
  ITEM_DAMAGED: "ITEM_DAMAGED",
  ITEM_NOT_AS_DESCRIBED: "ITEM_NOT_AS_DESCRIBED",
  WRONG_ITEM: "WRONG_ITEM",
  SELLER_UNRESPONSIVE: "SELLER_UNRESPONSIVE",
  OTHER: "OTHER",
} as const;

export type DisputeReason =
  (typeof DisputeReason)[keyof typeof DisputeReason];

export const OAuthProvider = {
  GOOGLE: "GOOGLE",
} as const;

export type OAuthProvider =
  (typeof OAuthProvider)[keyof typeof OAuthProvider];

export const OAuthStateAction = {
  LOGIN: "LOGIN",
  LINK: "LINK",
} as const;

export type OAuthStateAction =
  (typeof OAuthStateAction)[keyof typeof OAuthStateAction];

export const AuditEventType = {
  USER_REGISTERED: "USER_REGISTERED",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILURE: "LOGIN_FAILURE",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  LOGIN_BLOCKED: "LOGIN_BLOCKED",
  TOTP_SETUP_STARTED: "TOTP_SETUP_STARTED",
  TOTP_ENABLED: "TOTP_ENABLED",
  TOTP_VERIFICATION_FAILED: "TOTP_VERIFICATION_FAILED",
  TOTP_LOGIN_SUCCESS: "TOTP_LOGIN_SUCCESS",
  TOTP_DISABLED: "TOTP_DISABLED",
  RECOVERY_CODE_USED: "RECOVERY_CODE_USED",
  OAUTH_LOGIN_STARTED: "OAUTH_LOGIN_STARTED",
  OAUTH_LOGIN_SUCCESS: "OAUTH_LOGIN_SUCCESS",
  OAUTH_LOGIN_FAILURE: "OAUTH_LOGIN_FAILURE",
  OAUTH_ACCOUNT_CREATED: "OAUTH_ACCOUNT_CREATED",
  OAUTH_ACCOUNT_LINKED: "OAUTH_ACCOUNT_LINKED",
  OAUTH_LINK_REJECTED: "OAUTH_LINK_REJECTED",
  OAUTH_ACCOUNT_UNLINKED: "OAUTH_ACCOUNT_UNLINKED",
  PRODUCT_CREATED: "PRODUCT_CREATED",
  PRODUCT_UPDATED: "PRODUCT_UPDATED",
  PRODUCT_REMOVED: "PRODUCT_REMOVED",
  TRANSACTION_CREATED: "TRANSACTION_CREATED",
  PRODUCT_RESERVED: "PRODUCT_RESERVED",
  TRANSACTION_ACCEPTED: "TRANSACTION_ACCEPTED",
  TRANSACTION_SHIPPED: "TRANSACTION_SHIPPED",
  RECEIPT_CONFIRMED: "RECEIPT_CONFIRMED",
  FUNDS_RELEASED: "FUNDS_RELEASED",
  DISPUTE_OPENED: "DISPUTE_OPENED",
  DISPUTE_REVIEW_STARTED: "DISPUTE_REVIEW_STARTED",
  DISPUTE_REFUNDED: "DISPUTE_REFUNDED",
  DISPUTE_RELEASED_TO_SELLER: "DISPUTE_RELEASED_TO_SELLER",
  DISPUTE_REJECTED: "DISPUTE_REJECTED",
  DISPUTE_EVIDENCE_UPLOADED: "DISPUTE_EVIDENCE_UPLOADED",
  DISPUTE_EVIDENCE_VIEWED: "DISPUTE_EVIDENCE_VIEWED",
  DISPUTE_EVIDENCE_UPLOAD_REJECTED: "DISPUTE_EVIDENCE_UPLOAD_REJECTED",
  UNAUTHORIZED_ACCESS_ATTEMPT: "UNAUTHORIZED_ACCESS_ATTEMPT",
} as const;

export type AuditEventType =
  (typeof AuditEventType)[keyof typeof AuditEventType];

export type User = {
  id: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastFailedLoginAt: Date | null;
  passwordAuthEnabled: boolean;
  totpEnabled: boolean;
  totpSecret: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OAuthAccount = {
  id: string;
  userId: string;
  provider: OAuthProvider;
  providerAccountId: string;
  providerEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: User;
};

export type OAuthState = {
  id: string;
  stateHash: string;
  nonce: string;
  codeVerifier: string;
  action: OAuthStateAction;
  userId?: string;
  consumedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
};

export type OAuthExchangeCode = {
  id: string;
  codeHash: string;
  userId: string;
  action: OAuthStateAction;
  consumedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  user?: User;
};

export type RecoveryCode = {
  id: string;
  userId: string;
  codeHash: string;
  usedAt: Date | null;
  createdAt: Date;
};

export type LoginAttempt = {
  id: string;
  userId?: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
  successful: boolean;
  reason?: string;
  createdAt: Date;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  price: number;
  category: ProductCategory;
  condition: ProductCondition;
  status: ProductStatus;
  location: string;
  sellerId: string;
  createdAt: Date;
  updatedAt: Date;
  seller?: PublicUser;
};

export type TradeTransaction = {
  id: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  productName: string;
  agreedPrice: number;
  status: TransactionStatus;
  buyerConfirmedAt: Date | null;
  releasedAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  buyer?: PublicUser;
  seller?: PublicUser;
  product?: Product;
};

export type Dispute = {
  id: string;
  transactionId: string;
  raisedById: string;
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  previousTransactionStatus: TransactionStatus;
  adminNote: string | null;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  transaction?: TradeTransaction;
  raisedBy?: PublicUser;
  resolvedBy?: PublicUser | null;
  evidence?: DisputeEvidence[];
};

export type DisputeEvidence = {
  id: string;
  disputeId: string;
  uploadedById: string;
  originalName: string;
  storedName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  createdAt: Date;
  uploadedBy?: PublicUser;
  dispute?: Dispute;
};

export type AuditLog = {
  id: string;
  eventType: AuditEventType;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  actor?: PublicUser | null;
};

export type PublicUser = Pick<
  User,
  "id" | "username" | "email" | "role" | "createdAt" | "updatedAt"
>;

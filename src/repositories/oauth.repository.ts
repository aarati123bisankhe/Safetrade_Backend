import { type ClientSession } from "mongoose";
import {
  OAuthAccountModel,
  OAuthExchangeCodeModel,
  OAuthStateModel,
  UserModel,
  normalizeMongoDoc,
  publicUserSelect,
} from "../db/models";
import {
  OAuthProvider,
  type OAuthAccount,
  type OAuthExchangeCode,
  type OAuthState,
  OAuthStateAction,
  UserRole,
  type User,
} from "../db/types";
import { runInTransaction } from "../configs/database.config";

export const oauthRepository = {
  async createState(data: {
    stateHash: string;
    nonce: string;
    codeVerifier: string;
    action: OAuthStateAction;
    userId?: string;
    expiresAt: Date;
  }) {
    const state = await OAuthStateModel.create(data);
    return normalizeMongoDoc(state as unknown) as OAuthState;
  },

  async findStateByHash(stateHash: string) {
    const state = await OAuthStateModel.findOne({ stateHash }).lean();
    return state ? (normalizeMongoDoc(state as unknown) as OAuthState) : null;
  },

  async consumeState(id: string, consumedAt: Date) {
    const state = await OAuthStateModel.findByIdAndUpdate(id, { consumedAt }, { new: true }).lean();
    return state ? (normalizeMongoDoc(state as unknown) as OAuthState) : null;
  },

  async createExchangeCode(data: {
    codeHash: string;
    userId: string;
    action: OAuthStateAction;
    expiresAt: Date;
  }) {
    const code = await OAuthExchangeCodeModel.create(data);
    return normalizeMongoDoc(code as unknown) as OAuthExchangeCode;
  },

  async findExchangeCodeByHash(codeHash: string) {
    const code = await OAuthExchangeCodeModel.findOne({ codeHash })
      .populate("userId")
      .lean();
    if (!code) {
      return null;
    }
    const normalized = normalizeMongoDoc<any>(code);
    normalized.user = normalized.userId;
    return normalized as OAuthExchangeCode;
  },

  async consumeExchangeCode(id: string, consumedAt: Date) {
    const code = await OAuthExchangeCodeModel.findByIdAndUpdate(id, { consumedAt }, { new: true }).lean();
    return code ? (normalizeMongoDoc(code as unknown) as OAuthExchangeCode) : null;
  },

  async findOAuthAccount(provider: OAuthProvider, providerAccountId: string) {
    const account = await OAuthAccountModel.findOne({
      provider,
      providerAccountId,
    })
      .populate("userId")
      .lean();

    if (!account) {
      return null;
    }

    const normalized = normalizeMongoDoc<any>(account);
    normalized.user = normalized.userId;
    return normalized as OAuthAccount;
  },

  async findUserOAuthAccount(userId: string, provider: OAuthProvider) {
    const account = await OAuthAccountModel.findOne({ userId, provider }).lean();
    return account ? (normalizeMongoDoc(account as unknown) as OAuthAccount) : null;
  },

  countUserOAuthAccounts(userId: string) {
    return OAuthAccountModel.countDocuments({ userId });
  },

  async createOAuthAccount(data: {
    userId: string;
    provider: OAuthProvider;
    providerAccountId: string;
    providerEmail?: string;
  }) {
    const account = await OAuthAccountModel.create(data);
    return normalizeMongoDoc<OAuthAccount>(account);
  },

  deleteOAuthAccount(id: string) {
    return OAuthAccountModel.findByIdAndDelete(id).lean();
  },

  async findUserByEmail(email: string) {
    const user = await UserModel.findOne({ email: email.toLowerCase() }).lean();
    return user ? (normalizeMongoDoc(user as unknown) as User) : null;
  },

  async findUserById(userId: string) {
    const user = await UserModel.findById(userId).lean();
    return user ? (normalizeMongoDoc(user as unknown) as User) : null;
  },

  async createOAuthUser(data: {
    email: string;
    username: string;
    password: string;
  }) {
    const user = await UserModel.create({
      email: data.email.toLowerCase(),
      username: data.username,
      password: data.password,
      role: UserRole.BUYER,
      passwordAuthEnabled: false,
    });
    return normalizeMongoDoc(user as unknown) as User;
  },

  async updateUserPasswordAuth(userId: string, passwordAuthEnabled: boolean) {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { passwordAuthEnabled },
      { new: true },
    ).lean();
    if (!user) {
      throw new Error("User not found");
    }
    return normalizeMongoDoc(user as unknown) as User;
  },

  withTransaction<T>(callback: (session: ClientSession) => Promise<T>) {
    return runInTransaction(callback);
  },
};

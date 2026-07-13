import { OAuthProvider, OAuthStateAction, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../configs/database.config";

const oauthAccountInclude = {
  user: true,
} as const;

export const oauthRepository = {
  createState(data: {
    stateHash: string;
    nonce: string;
    codeVerifier: string;
    action: OAuthStateAction;
    userId?: string;
    expiresAt: Date;
  }) {
    return prisma.oAuthState.create({
      data,
    });
  },

  findStateByHash(stateHash: string) {
    return prisma.oAuthState.findUnique({
      where: { stateHash },
    });
  },

  consumeState(id: string, consumedAt: Date) {
    return prisma.oAuthState.update({
      where: { id },
      data: { consumedAt },
    });
  },

  createExchangeCode(data: {
    codeHash: string;
    userId: string;
    action: OAuthStateAction;
    expiresAt: Date;
  }) {
    return prisma.oAuthExchangeCode.create({
      data,
    });
  },

  findExchangeCodeByHash(codeHash: string) {
    return prisma.oAuthExchangeCode.findUnique({
      where: { codeHash },
      include: {
        user: true,
      },
    });
  },

  consumeExchangeCode(id: string, consumedAt: Date) {
    return prisma.oAuthExchangeCode.update({
      where: { id },
      data: { consumedAt },
    });
  },

  findOAuthAccount(provider: OAuthProvider, providerAccountId: string) {
    return prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      include: oauthAccountInclude,
    });
  },

  findUserOAuthAccount(userId: string, provider: OAuthProvider) {
    return prisma.oAuthAccount.findFirst({
      where: {
        userId,
        provider,
      },
    });
  },

  countUserOAuthAccounts(userId: string) {
    return prisma.oAuthAccount.count({
      where: { userId },
    });
  },

  createOAuthAccount(data: {
    userId: string;
    provider: OAuthProvider;
    providerAccountId: string;
    providerEmail?: string;
  }) {
    return prisma.oAuthAccount.create({
      data,
    });
  },

  deleteOAuthAccount(id: string) {
    return prisma.oAuthAccount.delete({
      where: { id },
    });
  },

  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
    });
  },

  findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
    });
  },

  async createOAuthUser(data: {
    email: string;
    username: string;
    password: string;
  }) {
    return prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        username: data.username,
        password: data.password,
        role: UserRole.BUYER,
        passwordAuthEnabled: false,
      },
    });
  },

  updateUserPasswordAuth(userId: string, passwordAuthEnabled: boolean) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordAuthEnabled },
    });
  },

  async withTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return prisma.$transaction(callback);
  },
};

import { prisma } from "../configs/database.config";

export type LoginAttemptCreateInput = {
  userId?: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
  successful: boolean;
  reason?: string;
};

export const loginAttemptRepository = {
  create(data: LoginAttemptCreateInput) {
    return prisma.loginAttempt.create({
      data,
    });
  },
};

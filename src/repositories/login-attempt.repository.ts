import { LoginAttemptModel, normalizeMongoDoc } from "../db/models";
import type { LoginAttempt } from "../db/types";

export type LoginAttemptCreateInput = {
  userId?: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
  successful: boolean;
  reason?: string;
};

export const loginAttemptRepository = {
  async create(data: LoginAttemptCreateInput): Promise<LoginAttempt> {
    const attempt = await LoginAttemptModel.create(data);
    return normalizeMongoDoc<LoginAttempt>(attempt);
  },
};

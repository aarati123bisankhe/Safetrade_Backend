import { RecoveryCodeModel, UserModel, normalizeMongoDoc } from "../db/models";
import type { RecoveryCode } from "../db/types";

export type RecoveryCodeCreateInput = {
  userId: string;
  codeHash: string;
};

export const totpRepository = {
  updateUser(userId: string, data: Record<string, unknown>) {
    return UserModel.findByIdAndUpdate(userId, data, { new: true }).lean();
  },

  async findRecoveryCodes(userId: string) {
    const codes = await RecoveryCodeModel.find({ userId })
      .sort({ createdAt: 1 })
      .lean();
    return normalizeMongoDoc(codes as unknown) as RecoveryCode[];
  },

  async createRecoveryCodes(data: RecoveryCodeCreateInput[]) {
    await RecoveryCodeModel.insertMany(data);
  },

  async markRecoveryCodeUsed(recoveryCodeId: string) {
    const code = await RecoveryCodeModel.findByIdAndUpdate(
      recoveryCodeId,
      { usedAt: new Date() },
      { new: true },
    ).lean();
    return code ? (normalizeMongoDoc(code as unknown) as RecoveryCode) : null;
  },

  async deleteRecoveryCodes(userId: string) {
    await RecoveryCodeModel.deleteMany({ userId });
  },
};

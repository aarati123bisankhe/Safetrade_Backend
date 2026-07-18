import { UserModel, normalizeMongoDoc } from "../db/models";
import type { User, UserRole } from "../db/types";

export type LoginSecurityUpdateInput = {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastFailedLoginAt: Date | null;
};

type CreateUserInput = {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  passwordAuthEnabled?: boolean;
};

export const userRepository = {
  async create(data: CreateUserInput): Promise<User> {
    const user = await UserModel.create({
      ...data,
      email: data.email.toLowerCase(),
    });
    return normalizeMongoDoc(user as unknown) as User;
  },

  async findByEmail(email: string): Promise<User | null> {
    const user = await UserModel.findOne({ email: email.toLowerCase() }).lean();
    return user ? (normalizeMongoDoc(user as unknown) as User) : null;
  },

  async findByUsername(username: string): Promise<User | null> {
    const user = await UserModel.findOne({ username }).lean();
    return user ? (normalizeMongoDoc(user as unknown) as User) : null;
  },

  async findById(id: string): Promise<User | null> {
    const user = await UserModel.findById(id).lean();
    return user ? (normalizeMongoDoc(user as unknown) as User) : null;
  },

  async updateLoginSecurity(id: string, data: LoginSecurityUpdateInput): Promise<User> {
    const user = await UserModel.findByIdAndUpdate(id, data, { new: true }).lean();
    if (!user) {
      throw new Error("User not found");
    }
    return normalizeMongoDoc(user as unknown) as User;
  },
};

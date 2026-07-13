import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { User, UserRole } from "@prisma/client";
import { env } from "../configs/env.config";
import { HttpError } from "../errors/http-error";
import { userRepository } from "../repositories/user.repository";
import { LoginInput, RegisterInput } from "../validators/auth.validator";

type SafeUser = Omit<User, "password">;

const sanitizeUser = (user: User): SafeUser => {
  const { password, ...safeUser } = user;
  return safeUser;
};

const createToken = (userId: string): string => {
  const signOptions: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign({ userId }, env.jwtSecret, signOptions);
};

export const authService = {
  async register(payload: RegisterInput) {
    const [existingEmailUser, existingUsernameUser] = await Promise.all([
      userRepository.findByEmail(payload.email),
      userRepository.findByUsername(payload.username.trim()),
    ]);

    if (existingEmailUser) {
      throw new HttpError(409, "User already exists with this email");
    }

    if (existingUsernameUser) {
      throw new HttpError(409, "Username is already taken");
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await userRepository.create({
      username: payload.username.trim(),
      email: payload.email.trim().toLowerCase(),
      password: passwordHash,
      role: UserRole.BUYER,
    });

    return {
      user: sanitizeUser(user),
      token: createToken(user.id),
    };
  },

  async login(payload: LoginInput) {
    const user = await userRepository.findByEmail(payload.email);

    if (!user) {
      throw new HttpError(401, "Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(
      payload.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new HttpError(401, "Invalid email or password");
    }

    return {
      user: sanitizeUser(user),
      token: createToken(user.id),
    };
  },

  async getMe(userId: string) {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    return sanitizeUser(user);
  },
};

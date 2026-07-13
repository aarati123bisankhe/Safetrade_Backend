import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { User, UserRole } from "@prisma/client";
import { env } from "../configs/env.config";
import { HttpError } from "../errors/http-error";
import { userRepository } from "../repositories/user.repository";
import { auditLogService, type RequestContext } from "./audit-log.service";
import { loginSecurityService } from "./login-security.service";
import { LoginInput, RegisterInput } from "../validators/auth.validator";

type SafeUser = Omit<
  User,
  | "password"
  | "failedLoginAttempts"
  | "lockedUntil"
  | "lastFailedLoginAt"
  | "totpSecret"
  | "passwordAuthEnabled"
>;

const sanitizeUser = (user: User): SafeUser => {
  const {
    password,
    failedLoginAttempts: _failedLoginAttempts,
    lockedUntil: _lockedUntil,
    lastFailedLoginAt: _lastFailedLoginAt,
    totpSecret: _totpSecret,
    passwordAuthEnabled: _passwordAuthEnabled,
    ...safeUser
  } = user;
  return safeUser;
};

const createToken = (userId: string): string => {
  const signOptions: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign({ userId }, env.jwtSecret, signOptions);
};

export const authService = {
  createAccessToken: createToken,

  async register(payload: RegisterInput, context?: RequestContext) {
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

    await auditLogService.createLogSafely({
      eventType: "USER_REGISTERED",
      actorId: user.id,
      targetType: "User",
      targetId: user.id,
      description: "A new user account was registered",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: {
        role: user.role,
      },
    });

    return {
      user: sanitizeUser(user),
      token: createToken(user.id),
    };
  },

  async login(payload: LoginInput, context?: RequestContext) {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const user = await userRepository.findByEmail(normalizedEmail);

    if (!user) {
      await loginSecurityService.recordUnknownUserFailure(
        normalizedEmail,
        context,
      );
      throw new HttpError(401, "Invalid email or password");
    }

    await loginSecurityService.ensureAccountIsNotLocked(user, context);

    if (!user.passwordAuthEnabled) {
      await loginSecurityService.recordPasswordLoginRejected(user, context);
      throw new HttpError(401, "Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(
      payload.password,
      user.password,
    );

    if (!isPasswordValid) {
      await loginSecurityService.recordFailedPassword(user, context);
      throw new HttpError(401, "Invalid email or password");
    }

    const mfaChallenge = await import("./totp.service").then(({ totpService }) =>
      totpService.createLoginChallenge(user),
    );

    if (mfaChallenge) {
      await loginSecurityService.clearFailedAttempts(user);

      return {
        user: sanitizeUser(user),
        ...mfaChallenge,
      };
    }

    await loginSecurityService.recordSuccessfulLogin(user, context);

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

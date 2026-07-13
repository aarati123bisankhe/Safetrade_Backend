import { User } from "@prisma/client";
import { HttpError } from "../errors/http-error";
import { loginAttemptRepository } from "../repositories/login-attempt.repository";
import { type LoginSecurityUpdateInput, userRepository } from "../repositories/user.repository";
import { auditLogService, type RequestContext } from "./audit-log.service";
import {
  ACCOUNT_LOCK_DURATION_MINUTES,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "../utils/security.constants";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const loginSecurityService = {
  async recordUnknownUserFailure(email: string, context?: RequestContext) {
    const normalizedEmail = normalizeEmail(email);

    await loginAttemptRepository.create({
      email: normalizedEmail,
      successful: false,
      reason: "USER_NOT_FOUND",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    await auditLogService.createLogSafely({
      eventType: "LOGIN_FAILURE",
      targetType: "User",
      description: "Login failed because the account could not be found",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: {
        reason: "USER_NOT_FOUND",
      },
    });
  },

  async ensureAccountIsNotLocked(user: User, context?: RequestContext) {
    if (!user.lockedUntil || user.lockedUntil <= new Date()) {
      return;
    }

    await loginAttemptRepository.create({
      userId: user.id,
      email: normalizeEmail(user.email),
      successful: false,
      reason: "ACCOUNT_LOCKED",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    await auditLogService.createLogSafely({
      eventType: "LOGIN_BLOCKED",
      actorId: user.id,
      targetType: "User",
      targetId: user.id,
      description: "Login attempt blocked because the account is temporarily locked",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: {
        lockedUntil: user.lockedUntil.toISOString(),
      },
    });

    throw new HttpError(
      423,
      "Login is temporarily unavailable. Please try again later.",
    );
  },

  async recordFailedPassword(user: User, context?: RequestContext) {
    const nextFailedCount = user.failedLoginAttempts + 1;
    const shouldLock = nextFailedCount >= MAX_FAILED_LOGIN_ATTEMPTS;
    const now = new Date();
    const lockedUntil = shouldLock
      ? new Date(
          now.getTime() + ACCOUNT_LOCK_DURATION_MINUTES * 60 * 1000,
        )
      : null;

    const updateData: LoginSecurityUpdateInput = {
      failedLoginAttempts: nextFailedCount,
      lastFailedLoginAt: now,
      lockedUntil,
    };

    await userRepository.updateLoginSecurity(user.id, updateData);

    await loginAttemptRepository.create({
      userId: user.id,
      email: normalizeEmail(user.email),
      successful: false,
      reason: shouldLock ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    await auditLogService.createLogSafely({
      eventType: shouldLock ? "ACCOUNT_LOCKED" : "LOGIN_FAILURE",
      actorId: user.id,
      targetType: "User",
      targetId: user.id,
      description: shouldLock
        ? "Account was temporarily locked after repeated failed login attempts"
        : "Login failed because an invalid password was provided",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: {
        failedLoginAttempts: nextFailedCount,
        ...(lockedUntil ? { lockedUntil: lockedUntil.toISOString() } : {}),
        reason: shouldLock ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS",
      },
    });

    return {
      failedLoginAttempts: nextFailedCount,
      lockedUntil,
      isLocked: shouldLock,
    };
  },

  async recordSuccessfulLogin(user: User, context?: RequestContext) {
    await userRepository.updateLoginSecurity(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastFailedLoginAt: null,
    });

    await loginAttemptRepository.create({
      userId: user.id,
      email: normalizeEmail(user.email),
      successful: true,
      reason: "LOGIN_SUCCESS",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    await auditLogService.createLogSafely({
      eventType: "LOGIN_SUCCESS",
      actorId: user.id,
      targetType: "User",
      targetId: user.id,
      description: "User logged in successfully",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: {
        role: user.role,
      },
    });
  },

  async clearFailedAttempts(user: User) {
    await userRepository.updateLoginSecurity(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastFailedLoginAt: null,
    });
  },
};

import request from "supertest";
import { AuditEventType } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/configs/database.config";
import {
  clearDatabase,
  createUser,
} from "../helpers/test-data";

const loginPath = "/api/auth/login";

const login = (
  email: string,
  password: string,
  rateLimitKey = `key-${Date.now()}-${Math.random()}`,
) =>
  request(app)
    .post(loginPath)
    .set("x-test-rate-limit-key", rateLimitKey)
    .send({ email, password });

describe("Auth Security API", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  it("failed login increments the counter", async () => {
    const user = await createUser({ password: "password123" });

    const response = await login(user.email, "wrong-password", "counter-1");

    expect(response.status).toBe(401);

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    expect(updatedUser.failedLoginAttempts).toBe(1);
    expect(updatedUser.lockedUntil).toBeNull();
    expect(updatedUser.lastFailedLoginAt).not.toBeNull();
  });

  it("11 failed attempts do not lock the account", async () => {
    const user = await createUser({ password: "password123" });

    for (let attempt = 1; attempt <= 11; attempt += 1) {
      const response = await login(user.email, "wrong-password", `before-lock-${attempt}`);
      expect(response.status).toBe(401);
    }

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    expect(updatedUser.failedLoginAttempts).toBe(11);
    expect(updatedUser.lockedUntil).toBeNull();
  });

  it("12th failed attempt locks the account", async () => {
    const user = await createUser({ password: "password123" });

    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const response = await login(user.email, "wrong-password", `lock-threshold-${attempt}`);
      expect(response.status).toBe(401);
    }

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        eventType: AuditEventType.ACCOUNT_LOCKED,
        actorId: user.id,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(updatedUser.failedLoginAttempts).toBe(12);
    expect(updatedUser.lockedUntil).not.toBeNull();
    expect(updatedUser.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(auditLog).not.toBeNull();
  });

  it("locked user cannot log in using the correct password", async () => {
    const user = await createUser({ password: "password123" });

    for (let attempt = 1; attempt <= 12; attempt += 1) {
      await login(user.email, "wrong-password", `locked-correct-${attempt}`);
    }

    const response = await login(user.email, user.plainPassword, "locked-correct-final");
    const blockedAuditLog = await prisma.auditLog.findFirst({
      where: {
        eventType: AuditEventType.LOGIN_BLOCKED,
        actorId: user.id,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(response.status).toBe(423);
    expect(response.body.message).toBe(
      "Login is temporarily unavailable. Please try again later.",
    );
    expect(blockedAuditLog).not.toBeNull();
  });

  it("successful login resets failed attempts", async () => {
    const user = await createUser({ password: "password123" });

    await login(user.email, "wrong-password", "reset-counter-1");
    await login(user.email, "wrong-password", "reset-counter-2");

    const response = await login(user.email, user.plainPassword, "reset-counter-3");

    expect(response.status).toBe(200);

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    const successAttempt = await prisma.loginAttempt.findFirst({
      where: {
        userId: user.id,
        successful: true,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(updatedUser.failedLoginAttempts).toBe(0);
    expect(updatedUser.lastFailedLoginAt).toBeNull();
    expect(successAttempt).not.toBeNull();
  });

  it("successful login clears lockedUntil after expiry", async () => {
    const user = await createUser({ password: "password123" });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 12,
        lockedUntil: new Date(Date.now() - 60_000),
        lastFailedLoginAt: new Date(Date.now() - 120_000),
      },
    });

    const response = await login(user.email, user.plainPassword, "expired-lock-success");

    expect(response.status).toBe(200);

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    expect(updatedUser.failedLoginAttempts).toBe(0);
    expect(updatedUser.lockedUntil).toBeNull();
    expect(updatedUser.lastFailedLoginAt).toBeNull();
  });

  it("unknown email returns a generic error and does not reveal account existence", async () => {
    const response = await login(
      "unknown-user@example.com",
      "wrong-password",
      "unknown-email",
    );

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password");

    const loginAttempt = await prisma.loginAttempt.findFirstOrThrow({
      where: {
        email: "unknown-user@example.com",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(loginAttempt.userId).toBeNull();
    expect(loginAttempt.successful).toBe(false);
    expect(loginAttempt.reason).toBe("USER_NOT_FOUND");
  });

  it("different accounts have separate counters", async () => {
    const firstUser = await createUser({
      email: "first-security@example.com",
      password: "password123",
    });
    const secondUser = await createUser({
      email: "second-security@example.com",
      password: "password123",
    });

    await login(firstUser.email, "wrong-password", "account-a");
    await login(firstUser.email, "wrong-password", "account-b");
    await login(secondUser.email, "wrong-password", "account-c");

    const [firstUpdatedUser, secondUpdatedUser] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: firstUser.id } }),
      prisma.user.findUniqueOrThrow({ where: { id: secondUser.id } }),
    ]);

    expect(firstUpdatedUser.failedLoginAttempts).toBe(2);
    expect(secondUpdatedUser.failedLoginAttempts).toBe(1);
  });

  it("changing IP does not bypass account lockout", async () => {
    const user = await createUser({ password: "password123" });

    for (let attempt = 1; attempt <= 12; attempt += 1) {
      await login(user.email, "wrong-password", `rotating-source-${attempt}`);
    }

    const response = await login(
      user.email,
      user.plainPassword,
      "rotating-source-after-lock",
    );

    expect(response.status).toBe(423);
  });

  it("rate limiter eventually returns 429", async () => {
    let response = await login(
      "rate-limit@example.com",
      "wrong-password",
      "shared-rate-limit-key",
    );

    for (let attempt = 2; attempt <= 20; attempt += 1) {
      response = await login(
        "rate-limit@example.com",
        "wrong-password",
        "shared-rate-limit-key",
      );
      expect([401, 429]).toContain(response.status);
    }

    const blockedResponse = await login(
      "rate-limit@example.com",
      "wrong-password",
      "shared-rate-limit-key",
    );

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body.message).toBe(
      "Too many login attempts. Please try again later.",
    );
  });

  it("password is never stored in LoginAttempt and records include timestamp and outcome", async () => {
    const user = await createUser({ password: "password123" });

    await login(user.email, "wrong-password", "attempt-record-failure");
    await login(user.email, user.plainPassword, "attempt-record-success");

    const attempts = await prisma.loginAttempt.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    expect(attempts).toHaveLength(2);
    expect(attempts[0].successful).toBe(false);
    expect(attempts[1].successful).toBe(true);
    expect(attempts[0].createdAt).toBeInstanceOf(Date);
    expect(attempts[1].createdAt).toBeInstanceOf(Date);
    expect(JSON.stringify(attempts)).not.toContain("password123");
    expect(JSON.stringify(attempts)).not.toContain("\"password\":");
  });
});

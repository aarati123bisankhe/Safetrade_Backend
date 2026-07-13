import jwt from "jsonwebtoken";
import request from "supertest";
import { AuditEventType, UserRole } from "@prisma/client";
import { generate } from "otplib";
import { app } from "../../src/app";
import { prisma } from "../../src/configs/database.config";
import {
  clearDatabase,
  createUser,
  createUserSession,
} from "../helpers/test-data";

const setupTotp = async (token: string) =>
  request(app)
    .post("/api/auth/totp/setup")
    .set("Authorization", `Bearer ${token}`);

const enableTotp = async (token: string, code: string, rateLimitKey = "totp-enable") =>
  request(app)
    .post("/api/auth/totp/enable")
    .set("Authorization", `Bearer ${token}`)
    .set("x-test-rate-limit-key", rateLimitKey)
    .send({ code });

const verifyTotpLogin = (
  mfaToken: string,
  code: string,
  rateLimitKey = "totp-verify",
) =>
  request(app)
    .post("/api/auth/totp/verify-login")
    .set("x-test-rate-limit-key", rateLimitKey)
    .send({ mfaToken, code });

const useRecoveryCode = (
  mfaToken: string,
  recoveryCode: string,
  rateLimitKey = "totp-recovery",
) =>
  request(app)
    .post("/api/auth/totp/recovery")
    .set("x-test-rate-limit-key", rateLimitKey)
    .send({ mfaToken, recoveryCode });

const loginWithPassword = (email: string, password: string, rateLimitKey = "password-login") =>
  request(app)
    .post("/api/auth/login")
    .set("x-test-rate-limit-key", rateLimitKey)
    .send({ email, password });

const getCurrentUser = (token: string) =>
  request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${token}`);

const setupAndEnableTotp = async (token: string) => {
  const setupResponse = await setupTotp(token);
  const manualKey = setupResponse.body.data.manualKey as string;
  const code = await generate({ secret: manualKey });
  const enableResponse = await enableTotp(token, code, `enable-${Date.now()}`);

  return {
    setupResponse,
    enableResponse,
    manualKey,
    recoveryCodes: enableResponse.body.data.recoveryCodes as string[],
  };
};

describe("TOTP API", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  it("authenticated user can start TOTP setup", async () => {
    const user = await createUserSession();

    const response = await setupTotp(user.token);

    expect(response.status).toBe(200);
  });

  it("unauthenticated setup request receives 401", async () => {
    const response = await request(app).post("/api/auth/totp/setup");

    expect(response.status).toBe(401);
  });

  it("setup returns QR data and manual key and does not enable TOTP", async () => {
    const user = await createUserSession();

    const response = await setupTotp(user.token);

    expect(response.status).toBe(200);
    expect(response.body.data.qrCodeDataUrl).toContain("data:image/png;base64,");
    expect(response.body.data.manualKey).toBeTruthy();

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.user.id },
    });

    expect(storedUser.totpEnabled).toBe(false);
  });

  it("valid code enables TOTP", async () => {
    const user = await createUserSession();
    const { manualKey } = await setupAndEnableTotp(user.token);
    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.user.id },
    });

    expect(await generate({ secret: manualKey })).toBeTruthy();
    expect(storedUser.totpEnabled).toBe(true);
  });

  it("invalid code is rejected", async () => {
    const user = await createUserSession();
    await setupTotp(user.token);

    const response = await enableTotp(user.token, "000000", "invalid-enable");

    expect(response.status).toBe(401);
  });

  it("recovery codes are generated and stored recovery codes are hashed", async () => {
    const user = await createUserSession();
    const { recoveryCodes } = await setupAndEnableTotp(user.token);
    const storedCodes = await prisma.recoveryCode.findMany({
      where: { userId: user.user.id },
    });

    expect(recoveryCodes).toHaveLength(8);
    expect(storedCodes).toHaveLength(8);
    expect(storedCodes[0].codeHash).not.toBe(recoveryCodes[0]);
  });

  it("TOTP secret is not stored as plaintext", async () => {
    const user = await createUserSession();
    const { manualKey } = await setupAndEnableTotp(user.token);
    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.user.id },
    });

    expect(storedUser.totpSecret).not.toBeNull();
    expect(storedUser.totpSecret).not.toBe(manualKey);
    expect(storedUser.totpSecret).not.toContain(manualKey);
  });

  it("login with correct password returns MFA challenge", async () => {
    const user = await createUser({
      email: "totp-login@example.com",
      password: "password123",
    });
    const session = { user, token: jwt.sign({ userId: user.id }, process.env.JWT_SECRET ?? "test-secret") };
    await setupAndEnableTotp(session.token);

    const response = await loginWithPassword(user.email, user.plainPassword, "mfa-password");

    expect(response.status).toBe(200);
    expect(response.body.data.requiresTotp).toBe(true);
    expect(response.body.data.mfaToken).toBeTruthy();
    expect(response.body.data.token).toBeUndefined();
  });

  it("MFA challenge token cannot access protected endpoints", async () => {
    const user = await createUser({
      email: "totp-protected@example.com",
      password: "password123",
    });
    const session = { user, token: jwt.sign({ userId: user.id }, process.env.JWT_SECRET ?? "test-secret") };
    await setupAndEnableTotp(session.token);

    const loginResponse = await loginWithPassword(user.email, user.plainPassword, "mfa-protected");

    const response = await getCurrentUser(loginResponse.body.data.mfaToken);

    expect(response.status).toBe(401);
  });

  it("valid TOTP code completes login", async () => {
    const user = await createUser({
      email: "totp-verify@example.com",
      password: "password123",
    });
    const session = { user, token: jwt.sign({ userId: user.id }, process.env.JWT_SECRET ?? "test-secret") };
    const { manualKey } = await setupAndEnableTotp(session.token);
    const loginResponse = await loginWithPassword(user.email, user.plainPassword, "verify-password");

    const response = await verifyTotpLogin(
      loginResponse.body.data.mfaToken,
      await generate({ secret: manualKey }),
      "valid-verify",
    );

    expect(response.status).toBe(200);
    expect(response.body.data.token).toBeTruthy();
  });

  it("invalid TOTP code is rejected", async () => {
    const user = await createUser({
      email: "totp-invalid@example.com",
      password: "password123",
    });
    const session = { user, token: jwt.sign({ userId: user.id }, process.env.JWT_SECRET ?? "test-secret") };
    await setupAndEnableTotp(session.token);
    const loginResponse = await loginWithPassword(user.email, user.plainPassword, "invalid-password");

    const response = await verifyTotpLogin(
      loginResponse.body.data.mfaToken,
      "000000",
      "invalid-verify",
    );

    expect(response.status).toBe(401);
  });

  it("expired MFA token is rejected", async () => {
    const user = await createUser();
    const expiredToken = jwt.sign(
      { sub: user.id, purpose: "totp_login" },
      process.env.MFA_TOKEN_SECRET ?? "test-mfa-secret",
      { expiresIn: "-1s" },
    );

    const response = await verifyTotpLogin(expiredToken, "123456", "expired-token");

    expect(response.status).toBe(401);
  });

  it("wrong-purpose token is rejected", async () => {
    const wrongPurposeToken = jwt.sign(
      { sub: "user-id", purpose: "access" },
      process.env.MFA_TOKEN_SECRET ?? "test-mfa-secret",
      { expiresIn: "5m" },
    );

    const response = await verifyTotpLogin(wrongPurposeToken, "123456", "wrong-purpose");

    expect(response.status).toBe(401);
  });

  it("OTP verification is rate-limited", async () => {
    const user = await createUser({
      email: "totp-rate@example.com",
      password: "password123",
    });
    const session = { user, token: jwt.sign({ userId: user.id }, process.env.JWT_SECRET ?? "test-secret") };
    await setupAndEnableTotp(session.token);
    const loginResponse = await loginWithPassword(user.email, user.plainPassword, "otp-rate-password");
    const mfaToken = loginResponse.body.data.mfaToken as string;

    let response = await verifyTotpLogin(mfaToken, "000000", "otp-rate-limit");

    for (let attempt = 2; attempt <= 5; attempt += 1) {
      response = await verifyTotpLogin(mfaToken, "000000", "otp-rate-limit");
      expect([401, 429]).toContain(response.status);
    }

    const blocked = await verifyTotpLogin(mfaToken, "000000", "otp-rate-limit");

    expect(blocked.status).toBe(429);
  });

  it("recovery code completes login and cannot be reused", async () => {
    const user = await createUser({
      email: "totp-recovery@example.com",
      password: "password123",
    });
    const session = { user, token: jwt.sign({ userId: user.id }, process.env.JWT_SECRET ?? "test-secret") };
    const { recoveryCodes } = await setupAndEnableTotp(session.token);
    const loginResponse = await loginWithPassword(user.email, user.plainPassword, "recovery-password");

    const recoveryResponse = await useRecoveryCode(
      loginResponse.body.data.mfaToken,
      recoveryCodes[0],
      "recovery-use",
    );

    expect(recoveryResponse.status).toBe(200);
    expect(recoveryResponse.body.data.token).toBeTruthy();

    const reusedResponse = await useRecoveryCode(
      loginResponse.body.data.mfaToken,
      recoveryCodes[0],
      "recovery-reuse",
    );

    expect(reusedResponse.status).toBe(401);
  });

  it("disable requires password and second factor and successful disable removes secret and recovery codes", async () => {
    const user = await createUserSession({
      email: "totp-disable@example.com",
      password: "password123",
    });
    const { manualKey } = await setupAndEnableTotp(user.token);

    const invalidDisable = await request(app)
      .post("/api/auth/totp/disable")
      .set("Authorization", `Bearer ${user.token}`)
      .set("x-test-rate-limit-key", "disable-invalid")
      .send({
        password: user.user.plainPassword,
        code: "000000",
      });

    expect(invalidDisable.status).toBe(401);

    const validDisable = await request(app)
      .post("/api/auth/totp/disable")
      .set("Authorization", `Bearer ${user.token}`)
      .set("x-test-rate-limit-key", "disable-valid")
      .send({
        password: user.user.plainPassword,
        code: await generate({ secret: manualKey }),
      });

    expect(validDisable.status).toBe(200);

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.user.id },
    });
    const recoveryCodes = await prisma.recoveryCode.findMany({
      where: { userId: user.user.id },
    });

    expect(storedUser.totpEnabled).toBe(false);
    expect(storedUser.totpSecret).toBeNull();
    expect(recoveryCodes).toHaveLength(0);
  });

  it("responses do not expose encrypted secrets and audit events are created correctly", async () => {
    const user = await createUserSession({
      email: "totp-audit@example.com",
      password: "password123",
    });
    const { setupResponse, enableResponse, manualKey, recoveryCodes } = await setupAndEnableTotp(user.token);
    const loginResponse = await loginWithPassword(user.user.email, user.user.plainPassword, "audit-login");
    const verifyResponse = await verifyTotpLogin(
      loginResponse.body.data.mfaToken,
      await generate({ secret: manualKey }),
      "audit-verify",
    );

    const recoveryLogin = await loginWithPassword(user.user.email, user.user.plainPassword, "audit-recovery-login");
    await useRecoveryCode(
      recoveryLogin.body.data.mfaToken,
      recoveryCodes[0],
      "audit-recovery",
    );

    await request(app)
      .post("/api/auth/totp/disable")
      .set("Authorization", `Bearer ${user.token}`)
      .set("x-test-rate-limit-key", "audit-disable")
      .send({
        password: user.user.plainPassword,
        code: await generate({ secret: manualKey }),
      });

    const serialized = JSON.stringify({
      setupResponse: setupResponse.body,
      enableResponse: enableResponse.body,
      verifyResponse: verifyResponse.body,
    });

    expect(serialized).not.toContain("totpSecret");

    const events = await prisma.auditLog.findMany({
      where: {
        actorId: user.user.id,
        eventType: {
          in: [
            AuditEventType.TOTP_SETUP_STARTED,
            AuditEventType.TOTP_ENABLED,
            AuditEventType.TOTP_LOGIN_SUCCESS,
            AuditEventType.RECOVERY_CODE_USED,
            AuditEventType.TOTP_DISABLED,
          ],
        },
      },
    });

    const eventTypes = events.map((event) => event.eventType);
    expect(eventTypes).toContain(AuditEventType.TOTP_SETUP_STARTED);
    expect(eventTypes).toContain(AuditEventType.TOTP_ENABLED);
    expect(eventTypes).toContain(AuditEventType.TOTP_LOGIN_SUCCESS);
    expect(eventTypes).toContain(AuditEventType.RECOVERY_CODE_USED);
    expect(eventTypes).toContain(AuditEventType.TOTP_DISABLED);
  });
});

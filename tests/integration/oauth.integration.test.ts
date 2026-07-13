import jwt from "jsonwebtoken";
import request from "supertest";
import { generate } from "otplib";
import { OAuthProvider, UserRole } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/configs/database.config";
import { oauthService } from "../../src/services/oauth.service";
import {
  clearDatabase,
  createUser,
  createUserSession,
} from "../helpers/test-data";

type MockIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  nonce: string;
  issuer: string;
  audience: string;
  expiresAt: number;
};

let mockIdentity: MockIdentity = {
  sub: "google-sub-1",
  email: "oauth-user@example.com",
  emailVerified: true,
  nonce: "",
  issuer: "https://accounts.google.com",
  audience: process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id",
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
};

let shouldThrowExchangeError = false;

const getCurrentUser = (token: string) =>
  request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${token}`);

const startLogin = () => request(app).get("/api/auth/google");

const exchangeCode = (code: string) =>
  request(app).post("/api/auth/oauth/exchange").send({ code });

const parseLocation = (response: request.Response) => {
  const location = response.headers.location;

  if (!location) {
    throw new Error("Expected redirect location to be present");
  }

  return new URL(location);
};

const readStoredState = async () =>
  prisma.oAuthState.findFirstOrThrow({
    orderBy: { createdAt: "desc" },
  });

const runCallback = (state: string, code = "mock-code") =>
  request(app).get("/api/auth/google/callback").query({ state, code });

const setupTotp = async (token: string) =>
  request(app)
    .post("/api/auth/totp/setup")
    .set("Authorization", `Bearer ${token}`);

const enableTotp = async (token: string, code: string) =>
  request(app)
    .post("/api/auth/totp/enable")
    .set("Authorization", `Bearer ${token}`)
    .set("x-test-rate-limit-key", `oauth-totp-enable-${Date.now()}`)
    .send({ code });

describe("OAuth API", () => {
  beforeEach(async () => {
    await clearDatabase();

    mockIdentity = {
      sub: "google-sub-1",
      email: "oauth-user@example.com",
      emailVerified: true,
      nonce: "",
      issuer: "https://accounts.google.com",
      audience: process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    shouldThrowExchangeError = false;

    oauthService.__setGoogleOidcAdapterForTests({
      getAuthorizationUrl({ state, nonce, codeChallenge }) {
        mockIdentity.nonce = nonce;

        const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id");
        url.searchParams.set("redirect_uri", process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:5001/api/auth/google/callback");
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", "openid email profile");
        url.searchParams.set("state", state);
        url.searchParams.set("nonce", nonce);
        url.searchParams.set("code_challenge", codeChallenge);
        url.searchParams.set("code_challenge_method", "S256");
        return url.toString();
      },

      async exchangeAuthorizationCode() {
        if (shouldThrowExchangeError) {
          throw new Error("Mock Google verification failed");
        }

        return mockIdentity;
      },
    });
  });

  afterAll(async () => {
    oauthService.__resetGoogleOidcAdapterForTests();
    await clearDatabase();
  });

  it("Google login start creates state and redirects with minimum scopes", async () => {
    const response = await startLogin();

    expect(response.status).toBe(302);

    const location = parseLocation(response);
    const storedState = await readStoredState();

    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.searchParams.get("scope")).toBe("openid email profile");
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(location.searchParams.get("nonce")).toBeTruthy();
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(storedState.action).toBe("LOGIN");
    expect(storedState.consumedAt).toBeNull();
  });

  it("missing state is rejected through the failure redirect", async () => {
    const response = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "mock-code" });

    expect(response.status).toBe(302);

    const location = parseLocation(response);
    expect(location.origin + location.pathname).toBe(
      "http://localhost:5173/login",
    );
    expect(location.searchParams.get("error")).toContain("OAuth state is required");
  });

  it("incorrect state is rejected through the failure redirect", async () => {
    await startLogin();

    const response = await runCallback("wrong-state");

    expect(response.status).toBe(302);

    const location = parseLocation(response);
    expect(location.searchParams.get("error")).toContain("Invalid OAuth state");
  });

  it("expired state is rejected through the failure redirect", async () => {
    const startResponse = await startLogin();
    const state = parseLocation(startResponse).searchParams.get("state")!;
    const storedState = await readStoredState();

    await prisma.oAuthState.update({
      where: { id: storedState.id },
      data: {
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const response = await runCallback(state);

    expect(response.status).toBe(302);
    expect(parseLocation(response).searchParams.get("error")).toContain(
      "OAuth state has expired",
    );
  });

  it("reused state is rejected through the failure redirect", async () => {
    const startResponse = await startLogin();
    const state = parseLocation(startResponse).searchParams.get("state")!;

    const firstCallback = await runCallback(state);
    const secondCallback = await runCallback(state);

    expect(firstCallback.status).toBe(302);
    expect(secondCallback.status).toBe(302);
    expect(parseLocation(secondCallback).searchParams.get("error")).toContain(
      "already been used",
    );
  });

  it("new Google identity creates a BUYER account and exchanges once", async () => {
    const startResponse = await startLogin();
    const state = parseLocation(startResponse).searchParams.get("state")!;

    const callbackResponse = await runCallback(state);

    expect(callbackResponse.status).toBe(302);

    const successLocation = parseLocation(callbackResponse);
    const code = successLocation.searchParams.get("code");

    expect(code).toBeTruthy();
    expect(successLocation.search).not.toContain("token=");

    const exchangeResponse = await exchangeCode(code!);

    expect(exchangeResponse.status).toBe(200);
    expect(exchangeResponse.body.data.token).toBeTruthy();
    expect(exchangeResponse.body.data.user.role).toBe(UserRole.BUYER);

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { email: mockIdentity.email },
    });
    const storedAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: OAuthProvider.GOOGLE,
          providerAccountId: mockIdentity.sub,
        },
      },
    });

    expect(storedUser.passwordAuthEnabled).toBe(false);
    expect(storedAccount).not.toBeNull();

    const secondExchangeResponse = await exchangeCode(code!);
    expect(secondExchangeResponse.status).toBe(401);
  });

  it("existing provider sub logs in the linked user", async () => {
    const user = await createUser({
      email: "linked-oauth@example.com",
      password: "password123",
    });

    await prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: OAuthProvider.GOOGLE,
        providerAccountId: "linked-google-sub",
        providerEmail: user.email,
      },
    });

    mockIdentity = {
      ...mockIdentity,
      sub: "linked-google-sub",
      email: user.email,
    };

    const startResponse = await startLogin();
    const state = parseLocation(startResponse).searchParams.get("state")!;
    const callbackResponse = await runCallback(state);
    const exchangeResponse = await exchangeCode(
      parseLocation(callbackResponse).searchParams.get("code")!,
    );

    expect(exchangeResponse.status).toBe(200);
    expect(exchangeResponse.body.data.user.email).toBe(user.email);
  });

  it("matching email is not automatically linked", async () => {
    await createUser({
      email: mockIdentity.email,
      password: "password123",
    });

    const startResponse = await startLogin();
    const state = parseLocation(startResponse).searchParams.get("state")!;
    const callbackResponse = await runCallback(state);

    expect(callbackResponse.status).toBe(302);

    const location = parseLocation(callbackResponse);
    expect(location.searchParams.get("error")).toContain(
      "existing SafeTrade account",
    );

    const oauthAccountCount = await prisma.oAuthAccount.count();
    expect(oauthAccountCount).toBe(0);
  });

  it("TOTP-enabled OAuth user receives MFA challenge and cannot use it as an access token", async () => {
    const session = await createUserSession({
      email: "oauth-mfa@example.com",
      password: "password123",
    });

    const setupResponse = await setupTotp(session.token);
    const manualKey = setupResponse.body.data.manualKey as string;
    await enableTotp(session.token, await generate({ secret: manualKey }));

    await prisma.oAuthAccount.create({
      data: {
        userId: session.user.id,
        provider: OAuthProvider.GOOGLE,
        providerAccountId: "mfa-google-sub",
        providerEmail: session.user.email,
      },
    });

    mockIdentity = {
      ...mockIdentity,
      sub: "mfa-google-sub",
      email: session.user.email,
    };

    const startResponse = await startLogin();
    const state = parseLocation(startResponse).searchParams.get("state")!;
    const callbackResponse = await runCallback(state);
    const exchangeResponse = await exchangeCode(
      parseLocation(callbackResponse).searchParams.get("code")!,
    );

    expect(exchangeResponse.status).toBe(200);
    expect(exchangeResponse.body.data.requiresTotp).toBe(true);
    expect(exchangeResponse.body.data.token).toBeUndefined();

    const meResponse = await getCurrentUser(exchangeResponse.body.data.mfaToken);
    expect(meResponse.status).toBe(401);
  });

  it("linking requires authenticated SafeTrade account", async () => {
    const response = await request(app)
      .post("/api/auth/google/link")
      .send({ currentPassword: "password123" });

    expect(response.status).toBe(401);
  });

  it("authenticated user can start secure Google linking after re-authentication", async () => {
    const session = await createUserSession({
      email: "link-user@example.com",
      password: "password123",
    });

    const response = await request(app)
      .post("/api/auth/google/link")
      .set("Authorization", `Bearer ${session.token}`)
      .send({ currentPassword: "password123" });

    expect(response.status).toBe(200);
    expect(response.body.data.authorizationUrl).toContain("accounts.google.com");

    const storedState = await readStoredState();
    expect(storedState.action).toBe("LINK");
    expect(storedState.userId).toBe(session.user.id);
  });

  it("unlinking cannot remove the final login method", async () => {
    const oauthOnlyUser = await prisma.user.create({
      data: {
        username: "oauth-only-user",
        email: "oauth-only@example.com",
        password: await (await import("bcryptjs")).hash("random-secret", 10),
        role: UserRole.BUYER,
        passwordAuthEnabled: false,
      },
    });
    const token = jwt.sign(
      { userId: oauthOnlyUser.id },
      process.env.JWT_SECRET ?? "test-secret",
      { expiresIn: "7d" },
    );

    await prisma.oAuthAccount.create({
      data: {
        userId: oauthOnlyUser.id,
        provider: OAuthProvider.GOOGLE,
        providerAccountId: "oauth-only-google-sub",
        providerEmail: oauthOnlyUser.email,
      },
    });

    const response = await request(app)
      .delete("/api/auth/google/unlink")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "password123" });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("final login method");
  });

  it("audit logs do not expose provider tokens during OAuth login", async () => {
    const startResponse = await startLogin();
    const state = parseLocation(startResponse).searchParams.get("state")!;
    const callbackResponse = await runCallback(state);
    await exchangeCode(parseLocation(callbackResponse).searchParams.get("code")!);

    const logs = await prisma.auditLog.findMany({
      where: {
        eventType: {
          in: ["OAUTH_LOGIN_STARTED", "OAUTH_LOGIN_SUCCESS", "OAUTH_ACCOUNT_CREATED"],
        },
      },
    });

    expect(logs.length).toBeGreaterThan(0);

    for (const log of logs) {
      expect(JSON.stringify(log)).not.toContain("id_token");
      expect(JSON.stringify(log)).not.toContain("access_token");
      expect(JSON.stringify(log)).not.toContain("refresh_token");
    }
  });
});

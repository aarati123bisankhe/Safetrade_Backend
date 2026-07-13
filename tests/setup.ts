import path from "path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.test"),
});

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "file:./test.db";
process.env.JWT_SECRET ??= "test-secret";
process.env.MFA_TOKEN_SECRET ??= "test-mfa-secret";
process.env.TOTP_ENCRYPTION_KEY ??= "test-totp-encryption-key-32-bytes";
process.env.GOOGLE_CLIENT_ID ??= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-google-client-secret";
process.env.GOOGLE_REDIRECT_URI ??= "http://localhost:5001/api/auth/google/callback";
process.env.OAUTH_STATE_SECRET ??= "test-oauth-state-secret";
process.env.OAUTH_SUCCESS_REDIRECT ??= "http://localhost:5173/auth/oauth/callback";
process.env.OAUTH_FAILURE_REDIRECT ??= "http://localhost:5173/login";

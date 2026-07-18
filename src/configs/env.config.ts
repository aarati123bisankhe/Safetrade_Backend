import dotenv from "dotenv";

dotenv.config();

type EnvConfig = {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  redisEnabled: boolean;
  redisUrl?: string;
  httpsKeyPath?: string;
  httpsCertPath?: string;
  jwtPrivateKey: string;
  jwtPublicKey: string;
  jwtExpiresIn: string;
  mfaTokenPrivateKey: string;
  mfaTokenPublicKey: string;
  totpEncryptionKey: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  oauthStateSecret: string;
  oauthSuccessRedirect: string;
  oauthFailureRedirect: string;
};

const requiredEnv = [
  "DATABASE_URL",
  "JWT_PRIVATE_KEY",
  "JWT_PUBLIC_KEY",
  "TOTP_ENCRYPTION_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "OAUTH_STATE_SECRET",
  "OAUTH_SUCCESS_REDIRECT",
  "OAUTH_FAILURE_REDIRECT",
] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const normalizeMultilineEnv = (value: string) => value.replace(/\\n/g, "\n");
const parseBooleanEnv = (value?: string) => value === "true";

export const env: EnvConfig = {
  port: Number(process.env.PORT ?? 5000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL as string,
  redisEnabled: parseBooleanEnv(process.env.REDIS_ENABLED),
  redisUrl: process.env.REDIS_URL,
  httpsKeyPath: process.env.HTTPS_KEY_PATH,
  httpsCertPath: process.env.HTTPS_CERT_PATH,
  jwtPrivateKey: normalizeMultilineEnv(process.env.JWT_PRIVATE_KEY as string),
  jwtPublicKey: normalizeMultilineEnv(process.env.JWT_PUBLIC_KEY as string),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  mfaTokenPrivateKey: normalizeMultilineEnv(
    (process.env.MFA_TOKEN_PRIVATE_KEY ?? process.env.JWT_PRIVATE_KEY) as string,
  ),
  mfaTokenPublicKey: normalizeMultilineEnv(
    (process.env.MFA_TOKEN_PUBLIC_KEY ?? process.env.JWT_PUBLIC_KEY) as string,
  ),
  totpEncryptionKey: process.env.TOTP_ENCRYPTION_KEY as string,
  googleClientId: process.env.GOOGLE_CLIENT_ID as string,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI as string,
  oauthStateSecret: process.env.OAUTH_STATE_SECRET as string,
  oauthSuccessRedirect: process.env.OAUTH_SUCCESS_REDIRECT as string,
  oauthFailureRedirect: process.env.OAUTH_FAILURE_REDIRECT as string,
};

import dotenv from "dotenv";

dotenv.config();

type EnvConfig = {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  mfaTokenSecret: string;
  totpEncryptionKey: string;
};

const requiredEnv = [
  "DATABASE_URL",
  "JWT_SECRET",
  "MFA_TOKEN_SECRET",
  "TOTP_ENCRYPTION_KEY",
] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env: EnvConfig = {
  port: Number(process.env.PORT ?? 5000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL as string,
  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  mfaTokenSecret: process.env.MFA_TOKEN_SECRET as string,
  totpEncryptionKey: process.env.TOTP_ENCRYPTION_KEY as string,
};

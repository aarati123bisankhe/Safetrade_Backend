import crypto from "node:crypto";
import { env } from "../configs/env.config";

const hashValue = (value: string) =>
  crypto
    .createHmac("sha256", env.oauthStateSecret)
    .update(value)
    .digest("hex");

const generateRandomString = (size = 32) =>
  crypto.randomBytes(size).toString("base64url");

const generatePkceChallenge = (codeVerifier: string) =>
  crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

export const oauthStateSecurity = {
  generateState: () => generateRandomString(32),
  generateNonce: () => generateRandomString(24),
  generateCodeVerifier: () => generateRandomString(48),
  generateExchangeCode: () => generateRandomString(32),
  hashState: hashValue,
  hashExchangeCode: hashValue,
  generatePkceChallenge,
};

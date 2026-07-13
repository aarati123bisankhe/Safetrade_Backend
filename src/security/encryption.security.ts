import crypto from "node:crypto";
import { env } from "../configs/env.config";

const ALGORITHM = "aes-256-gcm";

const getKey = () =>
  crypto.createHash("sha256").update(env.totpEncryptionKey).digest();

export const encryptionSecurity = {
  encrypt(value: string) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString("base64"),
      authTag.toString("base64"),
      encrypted.toString("base64"),
    ].join(":");
  },

  decrypt(payload: string) {
    const [ivPart, authTagPart, encryptedPart] = payload.split(":");

    if (!ivPart || !authTagPart || !encryptedPart) {
      throw new Error("Invalid encrypted payload");
    }

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(ivPart, "base64"),
    );

    decipher.setAuthTag(Buffer.from(authTagPart, "base64"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, "base64")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  },
};

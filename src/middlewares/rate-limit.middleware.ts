import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createRateLimitStore } from "../configs/redis.config";

export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  store: createRateLimitStore("safetrade:login-rate-limit:"),
  passOnStoreError: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (request) =>
    request.get("x-test-rate-limit-key") ?? ipKeyGenerator(request.ip ?? ""),
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.", 
  },
});

export const otpRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  store: createRateLimitStore("safetrade:otp-rate-limit:"),
  passOnStoreError: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (request) =>
    request.get("x-test-rate-limit-key") ?? ipKeyGenerator(request.ip ?? ""),
  message: {
    success: false,
    message: "Too many TOTP attempts. Please try again later.",
  },
});

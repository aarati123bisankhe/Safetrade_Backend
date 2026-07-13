import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authenticationMiddleware } from "../middlewares/authentication.middleware";
import { loginRateLimiter } from "../middlewares/rate-limit.middleware"; 
import { oauthRoutes } from "./oauth.routes";
import { totpRoutes } from "./totp.routes";
import { asyncHandler } from "../utils/async-handler";

export const authRoutes = Router();

authRoutes.post("/register", asyncHandler(authController.register)); 
authRoutes.post("/login", loginRateLimiter, asyncHandler(authController.login)); 
authRoutes.get(
  "/me",
  asyncHandler(authenticationMiddleware),
  asyncHandler(authController.me),
);

authRoutes.use("/totp", totpRoutes);
authRoutes.use("/", oauthRoutes);

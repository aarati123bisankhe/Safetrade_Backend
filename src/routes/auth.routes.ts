import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authenticationMiddleware } from "../middlewares/authentication.middleware";
import { asyncHandler } from "../utils/async-handler";

export const authRoutes = Router();

authRoutes.post("/register", asyncHandler(authController.register)); // Route for user registration
authRoutes.post("/login", asyncHandler(authController.login)); 
authRoutes.get(
  "/me",
  asyncHandler(authenticationMiddleware),
  asyncHandler(authController.me),
);

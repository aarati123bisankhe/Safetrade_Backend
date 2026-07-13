import { UserRole } from "@prisma/client";
import { Router } from "express";
import { adminDashboardController } from "../controllers/admin-dashboard.controller";
import { authenticationMiddleware } from "../middlewares/authentication.middleware";
import { authorizeRoles } from "../middlewares/authorization.middleware";
import { asyncHandler } from "../utils/async-handler";

export const adminDashboardRoutes = Router();

adminDashboardRoutes.get(
  "/", 
  asyncHandler(authenticationMiddleware),
  authorizeRoles(UserRole.ADMIN),
  asyncHandler(adminDashboardController.getDashboard),
);

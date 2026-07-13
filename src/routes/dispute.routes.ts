import { Router } from "express";
import { disputeController } from "../controllers/dispute.controller";
import { evidenceRoutes } from "./evidence.routes";
import { authenticationMiddleware } from "../middlewares/authentication.middleware";
import { asyncHandler } from "../utils/async-handler";

export const disputeRoutes = Router();

disputeRoutes.post(
  "/", 
  asyncHandler(authenticationMiddleware),
  asyncHandler(disputeController.create),
);
disputeRoutes.get(
  "/my-disputes",
  asyncHandler(authenticationMiddleware),
  asyncHandler(disputeController.getMyDisputes),
);
disputeRoutes.get(
  "/:disputeId",
  asyncHandler(authenticationMiddleware),
  asyncHandler(disputeController.getById),
);
disputeRoutes.patch(
  "/:disputeId/review",
  asyncHandler(authenticationMiddleware),
  asyncHandler(disputeController.review),
);
disputeRoutes.patch(
  "/:disputeId/resolve",
  asyncHandler(authenticationMiddleware),
  asyncHandler(disputeController.resolve),
);

disputeRoutes.use(
  "/:disputeId/evidence",
  asyncHandler(authenticationMiddleware),
  evidenceRoutes,
);

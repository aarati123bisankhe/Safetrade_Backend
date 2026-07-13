import { Router } from "express";
import { evidenceController } from "../controllers/evidence.controller";
import { disputeEvidenceUpload } from "../middlewares/dispute-upload.middleware";
import { asyncHandler } from "../utils/async-handler";

export const evidenceRoutes = Router({ mergeParams: true });

evidenceRoutes.post(
  "/",
  disputeEvidenceUpload.single("file"),
  asyncHandler(evidenceController.upload),
);

evidenceRoutes.get(
  "/",
  asyncHandler(evidenceController.list),
);

evidenceRoutes.get(
  "/:evidenceId",
  asyncHandler(evidenceController.getById),
);

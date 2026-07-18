import { UserRole } from "../db/types";
import { Router } from "express";
import { productController } from "../controllers/product.controller";
import { authenticationMiddleware } from "../middlewares/authentication.middleware";
import { authorizeRoles } from "../middlewares/authorization.middleware";
import { productImageUpload } from "../middlewares/product-upload.middleware";
import { asyncHandler } from "../utils/async-handler";

export const productRoutes = Router();

productRoutes.get("/", asyncHandler(productController.getAll)); //product
productRoutes.get(
  "/my-products",
  asyncHandler(authenticationMiddleware),
  authorizeRoles(UserRole.SELLER, UserRole.ADMIN),
  asyncHandler(productController.getMyProducts),
);
productRoutes.get("/:productId", asyncHandler(productController.getById)); 
productRoutes.post(
  "/",
  asyncHandler(authenticationMiddleware),
  authorizeRoles(UserRole.SELLER, UserRole.ADMIN),
  productImageUpload.single("image"),
  asyncHandler(productController.create),
);
productRoutes.patch(
  "/:productId",
  asyncHandler(authenticationMiddleware),
  productImageUpload.single("image"),
  asyncHandler(productController.update),
);
productRoutes.delete(
  "/:productId",
  asyncHandler(authenticationMiddleware),
  asyncHandler(productController.remove),
);

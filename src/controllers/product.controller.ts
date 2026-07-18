import { Request, Response } from "express";
import { productService } from "../services/product.service";
import {
  createProductSchema,
  listProductsQuerySchema,
  myProductsQuerySchema,
  updateProductSchema,
} from "../validators/product.validator";

const getRequestContext = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.get("user-agent") ?? undefined,
});

const getProductPayload = (request: Request) => {
  const imageUrl = request.file
    ? `/uploads/products/${request.file.filename}`
    : undefined;

  return {
    ...request.body,
    ...(imageUrl ? { imageUrl } : {}),
  };
};

export const productController = { 
  async getAll(req: Request, res: Response) {
    const query = listProductsQuerySchema.parse(req.query);
    const products = await productService.getAllProducts(query);

    res.status(200).json({
      success: true,
      message: "Products fetched successfully", 
      data: products,
    });
  },

  async getById(req: Request, res: Response) {
    const product = await productService.getProductById(req.params.productId);

    res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: product,
    });
  },

  async getMyProducts(req: Request, res: Response) {
    const query = myProductsQuerySchema.parse(req.query);
    const products = await productService.getMyProducts(req.user!, query);

    res.status(200).json({
      success: true,
      message: "Seller products fetched successfully",
      data: products,
    });
  },

  async create(req: Request, res: Response) {
    const payload = createProductSchema.parse(getProductPayload(req));
    const product = await productService.createProduct(
      payload,
      req.user!,
      getRequestContext(req),
    );

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  },

  async update(req: Request, res: Response) {
    const payload = updateProductSchema.parse(getProductPayload(req));
    const product = await productService.updateProduct(
      req.params.productId,
      payload,
      req.user!,
      getRequestContext(req),
    );

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  },

  async remove(req: Request, res: Response) {
    await productService.deleteProduct(
      req.params.productId,
      req.user!,
      getRequestContext(req),
    );

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  },
};

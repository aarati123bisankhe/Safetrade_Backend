import { ProductStatus, UserRole } from "../db/types";
import { HttpError } from "../errors/http-error";
import { productRepository } from "../repositories/product.repository";
import { auditLogService, type RequestContext } from "./audit-log.service";
import {
  CreateProductInput,
  ListProductsQueryInput,
  UpdateProductInput,
} from "../validators/product.validator";

type AuthenticatedUser = {
  id: string;
  role: UserRole;
};

export const productService = {
  async getAllProducts(query: ListProductsQueryInput) {
    return productRepository.findMany(query);
  },

  async getProductById(productId: string) {
    const product = await productRepository.findById(productId);

    if (!product || product.status === ProductStatus.REMOVED) {
      throw new HttpError(404, "Product not found");
    }

    return product;
  },

  async getMyProducts(
    currentUser: AuthenticatedUser,
    filters: { status?: ProductStatus }
  ) {
    return productRepository.findBySeller({
      sellerId: currentUser.id,
      status: filters.status,
    });
  },

  async createProduct(
    payload: CreateProductInput,
    currentUser: AuthenticatedUser,
    context?: RequestContext,
  ) {
    const { name, description, imageUrl, price, category, condition, location } =
      payload;

    const product = await productRepository.create({
      name,
      description,
      ...(imageUrl ? { imageUrl } : {}),
      price,
      category,
      condition,
      location,
      sellerId: currentUser.id,
    });

    await auditLogService.createLogSafely({
      eventType: "PRODUCT_CREATED",
      actorId: currentUser.id,
      targetType: "Product",
      targetId: product.id,
      description: "Seller created a product listing",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: {
        category: product.category,
        condition: product.condition,
        status: product.status,
      },
    });

    return product;
  },

  async updateProduct(
    productId: string,
    payload: UpdateProductInput,
    currentUser: AuthenticatedUser,
    context?: RequestContext,
  ) {
    const product = await productRepository.findById(productId);

    if (!product || product.status === ProductStatus.REMOVED) {
      throw new HttpError(404, "Product not found");
    }

    const canManage =
      currentUser.role === UserRole.ADMIN || product.sellerId === currentUser.id;

    if (!canManage) {
      throw new HttpError(403, "You do not have permission to modify this product");
    }

    const updateData = {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl } : {}),
      ...(payload.price !== undefined ? { price: payload.price } : {}),
      ...(payload.category !== undefined ? { category: payload.category } : {}),
      ...(payload.condition !== undefined ? { condition: payload.condition } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.location !== undefined ? { location: payload.location } : {}),
    };

    const updatedProduct = await productRepository.update(productId, updateData);

    await auditLogService.createLogSafely({
      eventType: "PRODUCT_UPDATED",
      actorId: currentUser.id,
      targetType: "Product",
      targetId: updatedProduct.id,
      description: "Product listing was updated",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: {
        status: updatedProduct.status,
      },
    });

    return updatedProduct;
  },

  async deleteProduct(
    productId: string,
    currentUser: AuthenticatedUser,
    context?: RequestContext,
  ) {
    const product = await productRepository.findById(productId);

    if (!product || product.status === ProductStatus.REMOVED) {
      throw new HttpError(404, "Product not found");
    }

    const canManage =
      currentUser.role === UserRole.ADMIN || product.sellerId === currentUser.id;

    if (!canManage) {
      throw new HttpError(403, "You do not have permission to delete this product");
    }

    const deletedProduct = await productRepository.delete(productId);

    await auditLogService.createLogSafely({
      eventType: "PRODUCT_REMOVED",
      actorId: currentUser.id,
      targetType: "Product",
      targetId: deletedProduct.id,
      description: "Product listing was removed",
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: {
        sellerId: deletedProduct.sellerId,
      },
    });

    return deletedProduct;
  },
};

import { Prisma, ProductStatus, UserRole } from "@prisma/client";
import { HttpError } from "../errors/http-error";
import { productRepository } from "../repositories/product.repository";
import {
  CreateProductInput,
  UpdateProductInput,
} from "../validators/product.validator";

type AuthenticatedUser = {
  id: string;
  role: UserRole;
};

export const productService = { //product
  async getAllProducts() {
    return productRepository.findAll();
  },

  async getProductById(productId: string) {
    const product = await productRepository.findById(productId);

    if (!product || product.status === ProductStatus.REMOVED) {
      throw new HttpError(404, "Product not found");
    }

    return product;
  },

  async createProduct(payload: CreateProductInput, currentUser: AuthenticatedUser) {
    const { name, description, price, category, condition, location } = payload;

    return productRepository.create({
      name,
      description,
      price,
      category,
      condition,
      location,
      seller: {
        connect: {
          id: currentUser.id,
        },
      },
    });
  },

  async updateProduct(
    productId: string,
    payload: UpdateProductInput,
    currentUser: AuthenticatedUser,
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
      ...(payload.price !== undefined ? { price: payload.price } : {}),
      ...(payload.category !== undefined ? { category: payload.category } : {}),
      ...(payload.condition !== undefined ? { condition: payload.condition } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.location !== undefined ? { location: payload.location } : {}),
    } satisfies Prisma.ProductUpdateInput;

    return productRepository.update(productId, updateData);
  },

  async deleteProduct(productId: string, currentUser: AuthenticatedUser) {
    const product = await productRepository.findById(productId);

    if (!product || product.status === ProductStatus.REMOVED) {
      throw new HttpError(404, "Product not found");
    }

    const canManage =
      currentUser.role === UserRole.ADMIN || product.sellerId === currentUser.id;

    if (!canManage) {
      throw new HttpError(403, "You do not have permission to delete this product");
    }

    return productRepository.delete(productId);
  },
};

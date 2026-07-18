import { ProductCategory, ProductCondition, ProductStatus } from "../db/types";
import { z } from "zod";

export const createProductSchema = z.object({ //product
  name: z.string().trim().min(2, "Product name must be at least 2 characters"),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters"),
  imageUrl: z.string().trim().min(1).optional(),
  price: z.coerce.number().positive("Price must be greater than 0"),
  category: z.nativeEnum(ProductCategory),
  condition: z.nativeEnum(ProductCondition),
  location: z.string().trim().min(2, "Location is required"),
});

export const updateProductSchema = z 
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Product name must be at least 2 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .min(10, "Description must be at least 10 characters")
      .optional(),
    imageUrl: z.string().trim().min(1).optional(),
    price: z.coerce.number().positive("Price must be greater than 0").optional(),
    category: z.nativeEnum(ProductCategory).optional(),
    condition: z.nativeEnum(ProductCondition).optional(),
    status: z.nativeEnum(ProductStatus).optional(),
    location: z.string().trim().min(2, "Location is required").optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided for update",
  });

export const listProductsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(8),
    search: z.string().trim().max(100).optional().default(""),
    category: z.nativeEnum(ProductCategory).optional(),
    condition: z.nativeEnum(ProductCondition).optional(),
    location: z.string().trim().max(100).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    sortBy: z
      .enum(["NEWEST", "PRICE_LOW_HIGH", "PRICE_HIGH_LOW"])
      .default("NEWEST"),
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    {
      message: "Minimum price cannot be greater than maximum price",
      path: ["minPrice"],
    }
  );

export const myProductsQuerySchema = z.object({
  status: z.nativeEnum(ProductStatus).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQueryInput = z.infer<typeof listProductsQuerySchema>;
export type MyProductsQueryInput = z.infer<typeof myProductsQuerySchema>;

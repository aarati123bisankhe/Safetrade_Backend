import { ProductCategory, ProductCondition, ProductStatus } from "@prisma/client"; 
import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters"),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters"),
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
    price: z.coerce.number().positive("Price must be greater than 0").optional(),
    category: z.nativeEnum(ProductCategory).optional(),
    condition: z.nativeEnum(ProductCondition).optional(),
    status: z.nativeEnum(ProductStatus).optional(),
    location: z.string().trim().min(2, "Location is required").optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided for update",
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

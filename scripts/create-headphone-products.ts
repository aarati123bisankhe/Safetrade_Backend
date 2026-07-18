import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

import { connectDatabase, disconnectDatabase } from "../src/configs/database.config";
import { ProductModel, UserModel } from "../src/db/models";
import {
  ProductCategory,
  ProductCondition,
  ProductStatus,
  UserRole,
} from "../src/db/types";

const DEMO_SELLER_EMAIL = "demo.seller@safetrade.local";
const DEMO_SELLER_PASSWORD = "Seller@123";
const screenshotsRoot = "/Users/aaratithapa/ScreenShots";
const uploadsRoot = path.resolve(process.cwd(), "uploads/products");

const products = [
  {
    name: "RGB Wireless Headphones",
    description:
      "Stylish over-ear wireless headphones with soft cushions, strong battery life, and RGB accent lighting.",
    price: 5800,
    category: ProductCategory.ELECTRONICS,
    condition: ProductCondition.NEW,
    location: "Kathmandu",
    sourceImage: "Screenshot 2026-07-16 at 21.21.08.png",
    targetImage: "rgb-wireless-headphones.png",
  },
  {
    name: "Comfort Bluetooth Headphones",
    description:
      "Lightweight black Bluetooth headphones with a clean design, comfortable ear pads, and everyday listening quality.",
    price: 4900,
    category: ProductCategory.ELECTRONICS,
    condition: ProductCondition.LIKE_NEW,
    location: "Lalitpur",
    sourceImage: "Screenshot 2026-07-16 at 21.24.55.png",
    targetImage: "comfort-bluetooth-headphones.png",
  },
  {
    name: "Audionic True Wireless Earbuds",
    description:
      "Compact Audionic earbuds with charging case, touch-style stems, and a pocket-friendly fully wireless design.",
    price: 3600,
    category: ProductCategory.ELECTRONICS,
    condition: ProductCondition.NEW,
    location: "Bhaktapur",
    sourceImage: "Screenshot 2026-07-16 at 21.26.15.png",
    targetImage: "audionic-true-wireless-earbuds.png",
  },
];

async function ensureDemoSeller() {
  let seller = await UserModel.findOne({ email: DEMO_SELLER_EMAIL });

  if (!seller) {
    const passwordHash = await bcrypt.hash(DEMO_SELLER_PASSWORD, 10);

    seller = await UserModel.create({
      username: "demo_seller",
      email: DEMO_SELLER_EMAIL,
      password: passwordHash,
      role: UserRole.SELLER,
    });
  }

  return seller;
}

function copyProductImage(sourceImage: string, targetImage: string) {
  fs.mkdirSync(uploadsRoot, { recursive: true });

  const sourcePath = path.join(screenshotsRoot, sourceImage);
  const targetPath = path.join(uploadsRoot, targetImage);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Screenshot not found: ${sourcePath}`);
  }

  fs.copyFileSync(sourcePath, targetPath);

  return `/uploads/products/${targetImage}`;
}

async function createProducts() {
  await connectDatabase();
  const seller = await ensureDemoSeller();

  let createdCount = 0;
  let skippedCount = 0;

  for (const product of products) {
    const existing = await ProductModel.findOne({
      sellerId: seller._id,
      name: product.name,
      status: { $ne: ProductStatus.REMOVED },
    });

    if (existing) {
      skippedCount += 1;
      continue;
    }

    const imageUrl = copyProductImage(product.sourceImage, product.targetImage);

    await ProductModel.create({
      name: product.name,
      description: product.description,
      imageUrl,
      price: product.price,
      category: product.category,
      condition: product.condition,
      status: ProductStatus.AVAILABLE,
      location: product.location,
      sellerId: seller._id,
    });

    createdCount += 1;
  }

  console.log(`Created ${createdCount} products.`);
  console.log(`Skipped ${skippedCount} products that already existed.`);
  console.log(`Seller login: ${DEMO_SELLER_EMAIL} / ${DEMO_SELLER_PASSWORD}`);
}

createProducts()
  .catch((error) => {
    console.error("Failed to create headphone products:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });

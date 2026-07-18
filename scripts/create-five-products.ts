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
    name: "Wooden Study Lamp",
    description:
      "Adjustable wooden study lamp in clean condition, suitable for reading desks and bedside tables.",
    price: 2100,
    category: ProductCategory.HANDMADE,
    condition: ProductCondition.LIKE_NEW,
    location: "Kathmandu",
    sourceImage: "Screenshot 2026-07-16 at 21.55.49.png",
    targetImage: "wooden-study-lamp.png",
  },
  {
    name: "Doraemon Plush Toy",
    description:
      "Soft Doraemon plush toy in very good shape, ideal for gifting or room decoration.",
    price: 1800,
    category: ProductCategory.HANDMADE,
    condition: ProductCondition.GOOD,
    location: "Lalitpur",
    sourceImage: "Screenshot 2026-07-16 at 21.56.25.png",
    targetImage: "doraemon-plush-toy.png",
  },
  {
    name: "Second-Hand iPhone",
    description:
      "Second-hand iPhone in excellent condition, used for around 3 to 4 months with smooth performance and a clean body.",
    price: 98000,
    category: ProductCategory.ELECTRONICS,
    condition: ProductCondition.LIKE_NEW,
    location: "Kathmandu",
    sourceImage: "Screenshot 2026-07-16 at 21.56.46.png",
    targetImage: "second-hand-iphone.png",
  },
  {
    name: "Wired In-Ear Earphones",
    description:
      "Simple wired in-ear earphones with 3.5 mm jack, built-in mic, and clear sound for daily use.",
    price: 900,
    category: ProductCategory.ELECTRONICS,
    condition: ProductCondition.NEW,
    location: "Bhaktapur",
    sourceImage: "Screenshot 2026-07-16 at 21.57.10.png",
    targetImage: "wired-in-ear-earphones.png",
  },
  {
    name: "Bluetooth Neckband Earphones",
    description:
      "Lightweight Bluetooth neckband earphones with comfortable fit and convenient everyday listening.",
    price: 2400,
    category: ProductCategory.ELECTRONICS,
    condition: ProductCondition.LIKE_NEW,
    location: "Pokhara",
    sourceImage: "Screenshot 2026-07-16 at 21.58.09.png",
    targetImage: "bluetooth-neckband-earphones.png",
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
    console.error("Failed to create products:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });

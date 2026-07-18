import fs from "fs";
import path from "path";

import { connectDatabase, disconnectDatabase } from "../src/configs/database.config";
import { ProductModel } from "../src/db/models";
import { ProductStatus } from "../src/db/types";

const uploadsRoot = path.resolve(process.cwd(), "uploads/products");

const productImages = [
  {
    productName: "Summer Dress",
    screenshotPath:
      "/Users/aaratithapa/ScreenShots/Screenshot 2026-07-16 at 22.11.34.png",
    targetImageName: "summer-dress.png",
  },
  {
    productName: "Denim Jacket",
    screenshotPath:
      "/Users/aaratithapa/ScreenShots/Screenshot 2026-07-16 at 22.13.35.png",
    targetImageName: "denim-jacket.png",
  },
];

function copyImage(screenshotPath: string, targetImageName: string) {
  fs.mkdirSync(uploadsRoot, { recursive: true });

  const targetPath = path.join(uploadsRoot, targetImageName);

  if (!fs.existsSync(screenshotPath)) {
    throw new Error(`Screenshot not found: ${screenshotPath}`);
  }

  fs.copyFileSync(screenshotPath, targetPath);

  return `/uploads/products/${targetImageName}`;
}

async function updateProductImages() {
  await connectDatabase();

  for (const item of productImages) {
    const imageUrl = copyImage(item.screenshotPath, item.targetImageName);

    const updatedProduct = await ProductModel.findOneAndUpdate(
      {
        name: item.productName,
        status: { $ne: ProductStatus.REMOVED },
      },
      {
        imageUrl,
      },
      { new: true }
    );

    if (!updatedProduct) {
      throw new Error(`${item.productName} product not found`);
    }

    console.log(`Updated image for product: ${updatedProduct.name}`);
    console.log(`Image URL: ${imageUrl}`);
  }
}

updateProductImages()
  .catch((error) => {
    console.error("Failed to update product images:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });

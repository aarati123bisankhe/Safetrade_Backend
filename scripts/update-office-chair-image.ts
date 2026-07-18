import fs from "fs";
import path from "path";

import { connectDatabase, disconnectDatabase } from "../src/configs/database.config";
import { ProductModel } from "../src/db/models";
import { ProductStatus } from "../src/db/types";

const screenshotPath =
  "/Users/aaratithapa/ScreenShots/Screenshot 2026-07-16 at 21.50.36.png";
const uploadsRoot = path.resolve(process.cwd(), "uploads/products");
const targetImageName = "office-chair.png";

function copyImage() {
  fs.mkdirSync(uploadsRoot, { recursive: true });

  const targetPath = path.join(uploadsRoot, targetImageName);

  if (!fs.existsSync(screenshotPath)) {
    throw new Error(`Screenshot not found: ${screenshotPath}`);
  }

  fs.copyFileSync(screenshotPath, targetPath);

  return `/uploads/products/${targetImageName}`;
}

async function updateOfficeChairImage() {
  await connectDatabase();

  const imageUrl = copyImage();

  const updatedProduct = await ProductModel.findOneAndUpdate(
    {
      name: "Office Chair",
      status: { $ne: ProductStatus.REMOVED },
    },
    {
      imageUrl,
    },
    { new: true }
  );

  if (!updatedProduct) {
    throw new Error("Office Chair product not found");
  }

  console.log(`Updated image for product: ${updatedProduct.name}`);
  console.log(`Image URL: ${imageUrl}`);
}

updateOfficeChairImage()
  .catch((error) => {
    console.error("Failed to update Office Chair image:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });

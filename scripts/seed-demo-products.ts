import bcrypt from "bcryptjs";

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

const demoProducts = [
  {
    name: "Clean Code",
    description: "Well-kept software engineering book with minimal markings.",
    price: 1800,
    category: ProductCategory.BOOKS,
    condition: ProductCondition.GOOD,
    location: "Kathmandu",
  },
  {
    name: "Data Structures Textbook",
    description: "University textbook in good condition for computing students.",
    price: 2200,
    category: ProductCategory.BOOKS,
    condition: ProductCondition.GOOD,
    location: "Lalitpur",
  },
  {
    name: "Wireless Headphones",
    description: "Bluetooth headphones with clear sound and solid battery life.",
    price: 6500,
    category: ProductCategory.ELECTRONICS,
    condition: ProductCondition.LIKE_NEW,
    location: "Bhaktapur",
  },
  {
    name: "Dell Inspiron Laptop",
    description: "Reliable used laptop for study, browsing, and office work.",
    price: 42000,
    category: ProductCategory.ELECTRONICS,
    condition: ProductCondition.GOOD,
    location: "Kathmandu",
  },
  {
    name: "Summer Dress",
    description: "Lightweight floral dress worn only a few times.",
    price: 2400,
    category: ProductCategory.CLOTHING,
    condition: ProductCondition.LIKE_NEW,
    location: "Pokhara",
  },
  {
    name: "Denim Jacket",
    description: "Classic blue denim jacket in very good shape.",
    price: 3200,
    category: ProductCategory.CLOTHING,
    condition: ProductCondition.GOOD,
    location: "Butwal",
  },
  {
    name: "Study Desk",
    description: "Wooden desk suitable for home study or office setup.",
    price: 12000,
    category: ProductCategory.FURNITURE,
    condition: ProductCondition.GOOD,
    location: "Lalitpur",
  },
  {
    name: "Office Chair",
    description: "Comfortable adjustable chair with minor signs of use.",
    price: 8500,
    category: ProductCategory.FURNITURE,
    condition: ProductCondition.FAIR,
    location: "Kathmandu",
  },
  {
    name: "Handmade Crochet Bag",
    description: "Locally handmade crochet shoulder bag with durable lining.",
    price: 2100,
    category: ProductCategory.HANDMADE,
    condition: ProductCondition.NEW,
    location: "Bhaktapur",
  },
  {
    name: "Clay Decorative Vase",
    description: "Handmade clay vase ideal for small flowers or desk decor.",
    price: 1500,
    category: ProductCategory.HANDMADE,
    condition: ProductCondition.NEW,
    location: "Patan",
  },
];

async function seedDemoProducts() {
  await connectDatabase();

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

  const existingCount = await ProductModel.countDocuments({
    sellerId: seller._id,
  });

  if (existingCount > 0) {
    console.log(
      `Demo data already exists for ${DEMO_SELLER_EMAIL}. Skipping product creation.`
    );
    console.log(`Seller login: ${DEMO_SELLER_EMAIL} / ${DEMO_SELLER_PASSWORD}`);
    return;
  }

  await ProductModel.insertMany(
    demoProducts.map((product) => ({
      ...product,
      sellerId: seller!._id,
      status: ProductStatus.AVAILABLE,
    }))
  );

  console.log(`Created ${demoProducts.length} demo products.`);
  console.log(`Seller login: ${DEMO_SELLER_EMAIL} / ${DEMO_SELLER_PASSWORD}`);
}

seedDemoProducts()
  .catch((error) => {
    console.error("Failed to seed demo products:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });

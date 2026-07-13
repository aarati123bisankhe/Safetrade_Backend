import path from "path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.test"),
});

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "file:./test.db";
process.env.JWT_SECRET ??= "test-secret";

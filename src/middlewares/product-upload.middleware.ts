import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { HttpError } from "../errors/http-error";

const uploadsDirectory = path.resolve(__dirname, "../../uploads/products");

fs.mkdirSync(uploadsDirectory, { recursive: true });

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const mimeExtensionMap: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const productImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_request: any, _file: any, callback: any) => {
      callback(null, uploadsDirectory);
    },
    filename: (_request: any, file: any, callback: any) => {
      const extension =
        mimeExtensionMap[file.mimetype] ??
        (path.extname(file.originalname || "").toLowerCase() || ".bin");

      callback(null, `${Date.now()}-${randomUUID()}${extension}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_request: any, file: any, callback: any) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new HttpError(415, "Unsupported product image type"));
    }

    callback(null, true);
  },
});

import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { HttpError } from "../errors/http-error";

export const errorMiddleware = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.flatten(),
    });
  }

  if (error instanceof Error && "code" in error) {
    const typedError = error as Error & { code?: string };

    if (typedError.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: "Uploaded file exceeds the 5 MB size limit",
      });
    }

    if (typedError.code?.startsWith("LIMIT_")) {
      return res.status(400).json({
        success: false,
        message: typedError.message,
      });
    }
  }

  if (error instanceof mongoose.Error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof jwt.JsonWebTokenError) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  console.error(error);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};

import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../db/types";
import { HttpError } from "../errors/http-error";

export const authorizeRoles =
  (...allowedRoles: UserRole[]) =>
  (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.user) {
      return next(new HttpError(401, "Authentication required"));
    }

    if (!allowedRoles.includes(request.user.role)) {
      return next(
        new HttpError(403, "You do not have permission to access this resource"),
      );
    }

    next();
  };

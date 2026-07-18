import type { ClientSession } from "mongoose";
import { ProductModel } from "../db/models";
import { ProductStatus } from "../db/types";
import { HttpError } from "../errors/http-error";

export const escrowService = {
  async reserveProduct(session: ClientSession, productId: string) {
    const result = await ProductModel.updateOne(
      {
        _id: productId,
        status: ProductStatus.AVAILABLE,
      },
      {
        $set: {
          status: ProductStatus.RESERVED,
        },
      },
      { session },
    );

    if (result.modifiedCount !== 1) {
      throw new HttpError(409, "Product is no longer available for purchase");
    }
  },
};

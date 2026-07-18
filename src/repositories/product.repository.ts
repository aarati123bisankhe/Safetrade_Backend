import { ProductModel, normalizeMongoDoc, publicUserSelect } from "../db/models";
import { ProductStatus, type Product } from "../db/types";

type CreateProductInput = {
  name: string;
  description: string;
  imageUrl?: string;
  price: number;
  category: Product["category"];
  condition: Product["condition"];
  location: string;
  sellerId: string;
};

type FindManyInput = {
  page: number;
  limit: number;
  search?: string;
  category?: Product["category"];
  condition?: Product["condition"];
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy: "NEWEST" | "PRICE_LOW_HIGH" | "PRICE_HIGH_LOW";
};

type FindBySellerInput = {
  sellerId: string;
  status?: Product["status"];
};

type PaginatedProductsResult = {
  items: Product[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function attachSeller(product: any): Product {
  const seller = product.sellerId && typeof product.sellerId === "object" ? product.sellerId : undefined;

  return {
    ...product,
    sellerId: seller?.id ?? product.sellerId,
    seller,
  } as Product;
}

export const productRepository = {
  async findMany(filters: FindManyInput): Promise<PaginatedProductsResult> {
    const query: Record<string, unknown> = {
      status: { $ne: ProductStatus.REMOVED },
    };

    if (filters.search) {
      const searchRegex = new RegExp(escapeRegex(filters.search), "i");
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { location: searchRegex },
        { category: searchRegex },
      ];
    }

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.condition) {
      query.condition = filters.condition;
    }

    if (filters.location) {
      query.location = new RegExp(`^${escapeRegex(filters.location)}$`, "i");
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.price = {
        ...(filters.minPrice !== undefined ? { $gte: filters.minPrice } : {}),
        ...(filters.maxPrice !== undefined ? { $lte: filters.maxPrice } : {}),
      };
    }

    const sort: Record<string, 1 | -1> =
      filters.sortBy === "PRICE_LOW_HIGH"
        ? { price: 1, createdAt: -1 }
        : filters.sortBy === "PRICE_HIGH_LOW"
          ? { price: -1, createdAt: -1 }
          : { createdAt: -1 };

    const skip = (filters.page - 1) * filters.limit;

    const [products, totalItems] = await Promise.all([
      ProductModel.find(query)
        .populate("sellerId", publicUserSelect)
        .sort(sort)
        .skip(skip)
        .limit(filters.limit)
        .lean(),
      ProductModel.countDocuments(query),
    ]);

    return {
      items: normalizeMongoDoc<any[]>(products).map(attachSeller),
      page: filters.page,
      limit: filters.limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / filters.limit)),
    };
  },

  async findAll(): Promise<Product[]> {
    const products = await ProductModel.find({
      status: { $ne: ProductStatus.REMOVED },
    })
      .populate("sellerId", publicUserSelect)
      .sort({ createdAt: -1 })
      .lean();

    return normalizeMongoDoc<any[]>(products).map(attachSeller);
  },

  async findBySeller({
    sellerId,
    status,
  }: FindBySellerInput): Promise<Product[]> {
    const query: Record<string, unknown> = {
      sellerId,
    };

    if (status) {
      query.status = status;
    }

    const products = await ProductModel.find(query)
      .populate("sellerId", publicUserSelect)
      .sort({ createdAt: -1 })
      .lean();

    return normalizeMongoDoc<any[]>(products).map(attachSeller);
  },

  async findById(id: string): Promise<Product | null> {
    const product = await ProductModel.findById(id)
      .populate("sellerId", publicUserSelect)
      .lean();

    if (!product) {
      return null;
    }

    return attachSeller(normalizeMongoDoc<any>(product));
  },

  async create(data: CreateProductInput): Promise<Product> {
    const created = await ProductModel.create(data);
    const product = await ProductModel.findById(created._id)
      .populate("sellerId", publicUserSelect)
      .lean();

    if (!product) {
      throw new Error("Product not found after creation");
    }

    return attachSeller(normalizeMongoDoc<any>(product));
  },

  async update(
    id: string,
    data: Partial<CreateProductInput & { status: Product["status"] }>
  ) {
    const product = await ProductModel.findByIdAndUpdate(id, data, { new: true })
      .populate("sellerId", publicUserSelect)
      .lean();

    if (!product) {
      throw new Error("Product not found");
    }

    return attachSeller(normalizeMongoDoc<any>(product));
  },

  async delete(id: string) {
    const product = await ProductModel.findByIdAndUpdate(
      id,
      { status: ProductStatus.REMOVED },
      { new: true }
    )
      .populate("sellerId", publicUserSelect)
      .lean();

    if (!product) {
      throw new Error("Product not found");
    }

    return attachSeller(normalizeMongoDoc<any>(product));
  },
};

import { TradeTransactionModel, normalizeMongoDoc, publicUserSelect, type MongoSession } from "../db/models";
import type { TradeTransaction } from "../db/types";

type TransactionCreateData = {
  buyerId: string;
  sellerId: string;
  productId: string;
  productName: string;
  agreedPrice: number;
  status: TradeTransaction["status"];
};

type TransactionUpdateData = Partial<
  Pick<
    TradeTransaction,
    "status" | "buyerConfirmedAt" | "releasedAt" | "refundedAt"
  >
>;

const transactionDetailsQuery = () =>
  TradeTransactionModel.find()
    .populate("buyerId", publicUserSelect)
    .populate("sellerId", publicUserSelect)
    .populate("productId");

export const transactionRepository = {
  async create(data: TransactionCreateData, session?: MongoSession) {
    const created = await TradeTransactionModel.create([{ ...data }], session ? { session } : {});
    const transaction = await TradeTransactionModel.findById(created[0]._id)
      .populate("buyerId", publicUserSelect)
      .populate("sellerId", publicUserSelect)
      .populate("productId")
      .session(session ?? null)
      .lean();

    if (!transaction) {
      throw new Error("Transaction not found after creation");
    }

    const normalized = normalizeMongoDoc<any>(transaction);
    normalized.buyer = normalized.buyerId;
    normalized.seller = normalized.sellerId;
    normalized.product = normalized.productId;
    normalized.buyerId = normalized.buyer?.id ?? normalized.buyerId;
    normalized.sellerId = normalized.seller?.id ?? normalized.sellerId;
    normalized.productId = normalized.product?.id ?? normalized.productId;
    return normalized as TradeTransaction;
  },

  async findById(transactionId: string) {
    const transaction = await TradeTransactionModel.findById(transactionId)
      .populate("buyerId", publicUserSelect)
      .populate("sellerId", publicUserSelect)
      .populate("productId")
      .lean();

    if (!transaction) {
      return null;
    }

    const normalized = normalizeMongoDoc<any>(transaction);
    normalized.buyer = normalized.buyerId;
    normalized.seller = normalized.sellerId;
    normalized.product = normalized.productId;
    normalized.buyerId = normalized.buyer?.id ?? normalized.buyerId;
    normalized.sellerId = normalized.seller?.id ?? normalized.sellerId;
    normalized.productId = normalized.product?.id ?? normalized.productId;
    return normalized as TradeTransaction;
  },

  async findBuyerTransactions(buyerId: string) {
    const transactions = await TradeTransactionModel.find({ buyerId })
      .populate("buyerId", publicUserSelect)
      .populate("sellerId", publicUserSelect)
      .populate("productId")
      .sort({ createdAt: -1 })
      .lean();

    return normalizeMongoDoc<any[]>(transactions).map((item) => {
      const buyer = item.buyerId;
      const seller = item.sellerId;
      const product = item.productId;

      return {
        ...item,
        buyer,
        seller,
        product,
        buyerId: buyer?.id ?? item.buyerId,
        sellerId: seller?.id ?? item.sellerId,
        productId: product?.id ?? item.productId,
      };
    }) as TradeTransaction[];
  },

  async findSellerTransactions(sellerId: string) {
    const transactions = await TradeTransactionModel.find({ sellerId })
      .populate("buyerId", publicUserSelect)
      .populate("sellerId", publicUserSelect)
      .populate("productId")
      .sort({ createdAt: -1 })
      .lean();

    return normalizeMongoDoc<any[]>(transactions).map((item) => {
      const buyer = item.buyerId;
      const seller = item.sellerId;
      const product = item.productId;

      return {
        ...item,
        buyer,
        seller,
        product,
        buyerId: buyer?.id ?? item.buyerId,
        sellerId: seller?.id ?? item.sellerId,
        productId: product?.id ?? item.productId,
      };
    }) as TradeTransaction[];
  },

  async updateStatus(
    transactionId: string,
    data: TransactionUpdateData,
    session?: MongoSession,
  ) {
    const transaction = await TradeTransactionModel.findByIdAndUpdate(
      transactionId,
      data,
      { new: true, session },
    )
      .populate("buyerId", publicUserSelect)
      .populate("sellerId", publicUserSelect)
      .populate("productId")
      .lean();

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    const normalized = normalizeMongoDoc<any>(transaction);
    normalized.buyer = normalized.buyerId;
    normalized.seller = normalized.sellerId;
    normalized.product = normalized.productId;
    normalized.buyerId = normalized.buyer?.id ?? normalized.buyerId;
    normalized.sellerId = normalized.seller?.id ?? normalized.sellerId;
    normalized.productId = normalized.product?.id ?? normalized.productId;
    return normalized as TradeTransaction;
  },
};

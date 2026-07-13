import { Prisma } from "@prisma/client";
import { prisma } from "../configs/database.config";

type DisputeCreateData =
  | Prisma.DisputeCreateInput
  | Prisma.DisputeUncheckedCreateInput;
type DisputeUpdateData =
  | Prisma.DisputeUpdateInput
  | Prisma.DisputeUncheckedUpdateInput;

export type DisputeClientLike = {
  dispute: {
    create: (args: {
      data: DisputeCreateData;
      include: typeof disputeDetailsInclude;
    }) => Promise<{ id: string }>;
    update: (args: {
      where: { id: string };
      data: DisputeUpdateData;
      include: typeof disputeDetailsInclude;
    }) => Promise<any>;
  };
  tradeTransaction: {
    update: (args: {
      where: { id: string };
      data: Prisma.TradeTransactionUpdateInput;
    }) => Promise<unknown>;
  };
  product: {
    update: (args: {
      where: { id: string };
      data: Prisma.ProductUpdateInput;
    }) => Promise<unknown>;
  };
};

const disputeDetailsInclude = {
  raisedBy: {
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  resolvedBy: {
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  transaction: {
    include: {
      buyer: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      seller: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          category: true,
          condition: true,
          status: true,
          location: true,
          sellerId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
  evidence: true,
} as const;

export const disputeRepository = {
  create(client: DisputeClientLike, data: DisputeCreateData) {
    return client.dispute.create({
      data,
      include: disputeDetailsInclude,
    });
  },

  findById(disputeId: string) {
    return prisma.dispute.findUnique({
      where: { id: disputeId },
      include: disputeDetailsInclude,
    });
  },

  findByTransactionId(transactionId: string) {
    return prisma.dispute.findUnique({
      where: { transactionId },
      include: disputeDetailsInclude,
    });
  },

  findVisibleDisputes(userId: string) {
    return prisma.dispute.findMany({
      where: {
        OR: [
          {
            transaction: {
              buyerId: userId,
            },
          },
          {
            transaction: {
              sellerId: userId,
            },
          },
        ],
      },
      include: disputeDetailsInclude,
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  update(client: DisputeClientLike, disputeId: string, data: DisputeUpdateData) {
    return client.dispute.update({
      where: { id: disputeId },
      data,
      include: disputeDetailsInclude,
    });
  },
};

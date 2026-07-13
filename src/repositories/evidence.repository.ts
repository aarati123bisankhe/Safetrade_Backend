import { prisma } from "../configs/database.config";

const evidenceInclude = {
  uploadedBy: {
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

export type EvidenceCreateInput = {
  disputeId: string;
  uploadedById: string;
  originalName: string;
  storedName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
};

export type EvidenceClientLike = any;

export const evidenceRepository = {
  create(client: EvidenceClientLike, data: EvidenceCreateInput) {
    return (client as any).disputeEvidence.create({
      data,
      include: evidenceInclude,
    });
  },

  findById(evidenceId: string) {
    return prisma.disputeEvidence.findUnique({
      where: { id: evidenceId },
      include: {
        ...evidenceInclude,
        dispute: {
          include: {
            transaction: {
              select: {
                buyerId: true,
                sellerId: true,
              },
            },
          },
        },
      },
    });
  },

  findByDisputeId(disputeId: string) {
    return prisma.disputeEvidence.findMany({
      where: { disputeId },
      include: evidenceInclude,
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  countByDisputeId(disputeId: string) {
    return prisma.disputeEvidence.count({
      where: { disputeId },
    });
  },
};


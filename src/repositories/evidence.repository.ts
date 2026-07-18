import {
  DisputeEvidenceModel,
  normalizeMongoDoc,
  publicUserSelect,
  type MongoSession,
} from "../db/models";

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

export const evidenceRepository = {
  async create(data: EvidenceCreateInput, session?: MongoSession) {
    const created = await DisputeEvidenceModel.create([{ ...data }], session ? { session } : {});
    const evidence = await DisputeEvidenceModel.findById(created[0]._id)
      .populate("uploadedById", publicUserSelect)
      .session(session ?? null)
      .lean();

    if (!evidence) {
      throw new Error("Evidence not found after creation");
    }

    const normalized = normalizeMongoDoc<any>(evidence);
    normalized.uploadedBy = normalized.uploadedById;
    return normalized;
  },

  async findById(evidenceId: string) {
    const evidence = await DisputeEvidenceModel.findById(evidenceId)
      .populate("uploadedById", publicUserSelect)
      .populate({
        path: "disputeId",
        populate: {
          path: "transactionId",
          select: "buyerId sellerId",
        },
      })
      .lean();

    if (!evidence) {
      return null;
    }

    const normalized = normalizeMongoDoc<any>(evidence);
    normalized.uploadedBy = normalized.uploadedById;
    normalized.dispute = {
      ...normalized.disputeId,
      transaction: normalized.disputeId.transactionId,
    };
    return normalized;
  },

  async findByDisputeId(disputeId: string) {
    const evidence = await DisputeEvidenceModel.find({ disputeId })
      .populate("uploadedById", publicUserSelect)
      .sort({ createdAt: -1 })
      .lean();

    return normalizeMongoDoc<any[]>(evidence).map((item) => ({
      ...item,
      uploadedBy: item.uploadedById,
    }));
  },

  countByDisputeId(disputeId: string) {
    return DisputeEvidenceModel.countDocuments({ disputeId });
  },
};

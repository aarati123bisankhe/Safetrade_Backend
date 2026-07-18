import { AuditLogModel, normalizeMongoDoc, publicUserSelect, type MongoSession } from "../db/models";
import type { AuditLog, AuditEventType } from "../db/types";

export type AuditLogCreateData = {
  eventType: AuditEventType;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: unknown;
};

export type AuditLogWhere = Record<string, unknown>;

export type AuditLogClientLike = MongoSession | undefined;

export const auditLogRepository = {
  async create(
    client: AuditLogClientLike,
    data: AuditLogCreateData,
  ) {
    const created = await AuditLogModel.create([{ ...data }], client ? { session: client } : {});
    return normalizeMongoDoc<AuditLog>(created[0]);
  },

  async findById(auditLogId: string) {
    const log = await AuditLogModel.findById(auditLogId)
      .populate("actorId", publicUserSelect)
      .lean();
    if (!log) {
      return null;
    }
    const normalized = normalizeMongoDoc<any>(log);
    normalized.actor = normalized.actorId ?? null;
    return normalized as AuditLog;
  },

  async findMany(args: {
    where: AuditLogWhere;
    skip: number;
    take: number;
  }) {
    const logs = await AuditLogModel.find(args.where)
      .populate("actorId", publicUserSelect)
      .sort({ createdAt: -1 })
      .skip(args.skip)
      .limit(args.take)
      .lean();
    return normalizeMongoDoc<any[]>(logs).map((item) => ({
      ...item,
      actor: item.actorId ?? null,
    })) as AuditLog[];
  },

  count(where: AuditLogWhere) {
    return AuditLogModel.countDocuments(where);
  },
};

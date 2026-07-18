import { UserRole, type AuditEventType } from "../db/types";
import { HttpError } from "../errors/http-error";
import {
  auditLogRepository,
  type AuditLogClientLike,
} from "../repositories/audit-log.repository";
import type { AuditLogQueryInput } from "../validators/audit-log.validator";

export type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

export type AuditEventTypeValue = AuditEventType;

export type CreateAuditLogInput = {
  eventType: AuditEventTypeValue;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

type AuthenticatedUser = {
  id: string;
  role: UserRole;
};

export const auditLogService = {
  async createLog(
    input: CreateAuditLogInput,
    client?: AuditLogClientLike,
  ) {
    return auditLogRepository.create(client, {
      eventType: input.eventType,
      actorId: input.actorId,
      targetType: input.targetType,
      targetId: input.targetId,
      description: input.description,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: input.metadata,
    });
  },

  async createLogSafely(input: CreateAuditLogInput) {
    try {
      await auditLogService.createLog(input);
    } catch (error) {
      console.error("Failed to create audit log", error);
    }
  },

  async getAuditLogs(query: AuditLogQueryInput, currentUser: AuthenticatedUser) {
    if (currentUser.role !== UserRole.ADMIN) {
      throw new HttpError(403, "Only admins can access audit logs");
    }

    const where: Record<string, unknown> = {
      ...(query.eventType ? { eventType: query.eventType } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { $gte: new Date(query.from) } : {}),
              ...(query.to ? { $lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      auditLogRepository.findMany({
        where,
        skip,
        take: query.limit,
      }),
      auditLogRepository.count(where),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  },

  async getAuditLogById(auditLogId: string, currentUser: AuthenticatedUser) {
    if (currentUser.role !== UserRole.ADMIN) {
      throw new HttpError(403, "Only admins can access audit logs");
    }

    const auditLog = await auditLogRepository.findById(auditLogId);

    if (!auditLog) {
      throw new HttpError(404, "Audit log not found");
    }

    return auditLog;
  },
};

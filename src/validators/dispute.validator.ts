import { DisputeReason } from "@prisma/client";
import { z } from "zod";

export const disputeIdParamSchema = z.object({
  disputeId: z.string().trim().min(1, "Dispute id is required"),
});

export const createDisputeSchema = z.object({
  transactionId: z.string().trim().min(1, "Transaction id is required"),
  reason: z.nativeEnum(DisputeReason),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters long"),
});

export const resolveDisputeSchema = z.object({
  decision: z.enum(["REFUND_BUYER", "RELEASE_SELLER", "REJECT_DISPUTE"]),
  adminNote: z
    .string()
    .trim()
    .min(5, "Admin note must be at least 5 characters long"),
});

export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

import { z } from "zod";

export const dashboardQuerySchema = z.object({
  period: z.enum(["24h", "7d", "30d"]).default("24h"),
});

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;

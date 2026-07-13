import { HttpError } from "../errors/http-error";
import { adminDashboardRepository } from "../repositories/admin-dashboard.repository";
import type { DashboardQueryInput } from "../validators/admin-dashboard.validator";

const periodMilliseconds = { 
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
} as const;

type AuthenticatedUser = {
  id: string;
  role: "BUYER" | "SELLER" | "ADMIN";
};

export const adminDashboardService = { 
  async getDashboard(query: DashboardQueryInput, currentUser: AuthenticatedUser) {
    if (currentUser.role !== "ADMIN") {
      throw new HttpError(403, "Only admins can access the dashboard");
    }

    const since = new Date(Date.now() - periodMilliseconds[query.period]);
    const summary = await adminDashboardRepository.getSummary(since);

    return {
      period: query.period,
      since,
      ...summary,
    };
  },
};

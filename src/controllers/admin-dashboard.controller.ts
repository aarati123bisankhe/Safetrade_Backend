import type { Request, Response } from "express";
import { adminDashboardService } from "../services/admin-dashboard.service";
import { dashboardQuerySchema } from "../validators/admin-dashboard.validator";

export const adminDashboardController = { // Controller for handling admin dashboard requests
  async getDashboard(req: Request, res: Response) {
    const query = dashboardQuerySchema.parse(req.query);
    const dashboard = await adminDashboardService.getDashboard(query, req.user!);

    res.status(200).json({
      success: true,
      message: "Admin dashboard fetched successfully",
      data: dashboard,
    });
  },
};

import type { Request, Response } from "express";
import { oauthService } from "../services/oauth.service";
import {
  oauthExchangeSchema,
  oauthLinkSchema,
  oauthUnlinkSchema,
} from "../validators/oauth.validator";

const getRequestContext = (request: Request) => ({ 
  ipAddress: request.ip,
  userAgent: request.get("user-agent") ?? undefined,
});

export const oauthController = {
  async googleStart(req: Request, res: Response) {
    const result = await oauthService.startGoogleLogin(getRequestContext(req));
    res.redirect(302, result.authorizationUrl);
  },

  async googleCallback(req: Request, res: Response) {
    try {
      const result = await oauthService.handleGoogleCallback(
        {
          code: typeof req.query.code === "string" ? req.query.code : undefined,
          state: typeof req.query.state === "string" ? req.query.state : undefined,
        },
        getRequestContext(req),
      );

      res.redirect(302, result.redirectUrl);
    } catch (error) {
      const redirectUrl = oauthService.createFailureRedirectUrl(
        error instanceof Error ? error.message : "OAuth callback failed",
      );
      res.redirect(302, redirectUrl);
    }
  },

  async googleLink(req: Request, res: Response) {
    const payload = oauthLinkSchema.parse(req.body);
    const result = await oauthService.startGoogleLink(
      req.user!,
      payload,
      getRequestContext(req),
    );

    res.status(200).json({
      success: true,
      message: "Google account linking started successfully",
      data: result,
    });
  },

  async googleUnlink(req: Request, res: Response) {
    const payload = oauthUnlinkSchema.parse(req.body);
    await oauthService.unlinkGoogle(req.user!, payload, getRequestContext(req));

    res.status(200).json({
      success: true,
      message: "Google account unlinked successfully",
    });
  },

  async exchange(req: Request, res: Response) {
    const payload = oauthExchangeSchema.parse(req.body);
    const result = await oauthService.exchangeCode(payload, getRequestContext(req));

    res.status(200).json({
      success: true,
      message: "OAuth exchange completed successfully",
      data: result,
    });
  },
};

import type { Request, Response, NextFunction } from 'express';
import { siteUrl } from '../../../shared/server/utils/SiteUrl';

// One host for search engines: a page requested on www.<shop host> moves permanently to the shop's public URL
// (SHOP_PUBLIC_URL), so the www copy is never indexed as a duplicate of the real page. Only reads are redirected;
// a webhook or form posted to www is still served.
export function CanonicalHostMiddleware(req: Request, res: Response, next: NextFunction) {
  const canonical = new URL(siteUrl());
  if ((req.method === 'GET' || req.method === 'HEAD') && req.hostname === `www.${canonical.hostname}`)
    return res.redirect(301, `${canonical.origin}${req.originalUrl}`);
  next();
}

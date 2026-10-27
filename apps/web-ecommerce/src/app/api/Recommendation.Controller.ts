import type { Request, Response } from 'express';
import { Controller } from '../../shared/server/decorators/controller.decorator';
import { Get, Post } from '../../shared/server/decorators/router.decorator';
import ApiBaseController from './ApiBase.Controller';
import RecommendationService, { type SmartRecommendationQuery } from '../../core/server/services/RecommendationService';
import { asTrimmedString, toInteger } from '../../shared/server/utils/ValidationUtils';

@Controller('/recommendations')
export default class RecommendationController extends ApiBaseController {
  private service = new RecommendationService();

  @Get('/')
  async getRecommendations(req: Request, res: Response) {
    try {
      const query: SmartRecommendationQuery = {
        surface: asTrimmedString(req.query.surface) || undefined,
        strategy: asTrimmedString(req.query.strategy) || undefined,
        productId: asTrimmedString(req.query.productId) || undefined,
        sessionKey: asTrimmedString(req.query.sessionKey) || undefined,
        recentIds: req.query.recentIds as unknown as number[],
        recentQueries: req.query.recentQueries as unknown as string[],
        cartProductIds: req.query.cartProductIds as unknown as number[],
        cartSubtotalVnd: toInteger(req.query.cartSubtotalVnd) ?? undefined,
        category: asTrimmedString(req.query.category) || undefined,
        categoryId: toInteger(req.query.categoryId) ?? undefined,
        q: asTrimmedString(req.query.q) || undefined,
        maxPrice: toInteger(req.query.maxPrice) ?? undefined,
        limit: toInteger(req.query.limit) ?? undefined,
      };
      const result = await this.service.getSmartRecommendations(query, req.user?.id ?? null);
      return res.json(result);
    } catch (error) {
      return this.handleError(res, error, "RecommendationController's getRecommendations");
    }
  }

  @Post('/events')
  async recordEvent(req: Request, res: Response) {
    try {
      const result = await this.service.recordEvent(req.body || {}, req.user?.id ?? null);
      return this.sendSuccess(res, result, undefined, 201);
    } catch (error) {
      return this.handleError(res, error, "RecommendationController's recordEvent");
    }
  }
}


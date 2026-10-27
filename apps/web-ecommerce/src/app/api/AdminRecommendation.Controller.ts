import type { Request, Response } from 'express';
import { Controller } from '../../shared/server/decorators/controller.decorator';
import { Get, Put } from '../../shared/server/decorators/router.decorator';
import ApiBaseController from './ApiBase.Controller';
import RecommendationService from '../../core/server/services/RecommendationService';
import HttpError from '../../shared/server/utils/HttpError';
import { toInteger } from '../../shared/server/utils/ValidationUtils';

@Controller('/admin/recommendations')
export default class AdminRecommendationController extends ApiBaseController {
  private service = new RecommendationService();
  private requireAdmin(req: Request) {
    if (!req.user) throw HttpError.unauthorized();
    if (req.user.role !== 'ADMIN') throw HttpError.forbidden();
  }

  @Get('/analytics')
  async getAnalytics(req: Request, res: Response) {
    try {
      this.requireAdmin(req);
      const days = toInteger(req.query.days) ?? 30;
      const analytics = await this.service.getAdminAnalytics(days);
      return res.json(analytics);
    } catch (error) {
      return this.handleError(res, error, "AdminRecommendationController's getAnalytics");
    }
  }

  @Get('/config')
  async getConfig(req: Request, res: Response) {
    try {
      this.requireAdmin(req);
      const config = await this.service.getConfig();
      return res.json(config);
    } catch (error) {
      return this.handleError(res, error, "AdminRecommendationController's getConfig");
    }
  }

  @Put('/config')
  async updateConfig(req: Request, res: Response) {
    try {
      this.requireAdmin(req);
      const updated = await this.service.updateConfig(req.body || {}, req.user?.id ?? null);
      return this.sendSuccess(res, updated, 'Đã cập nhật cấu hình gợi ý sản phẩm thông minh.');
    } catch (error) {
      return this.handleError(res, error, "AdminRecommendationController's updateConfig");
    }
  }
}


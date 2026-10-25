import type { Request, Response } from 'express';
import { Controller } from '../../shared/server/decorators/controller.decorator';
import { Get } from '../../shared/server/decorators/router.decorator';
import ApiBaseController from './ApiBase.Controller';
import ValuationService from '../../core/server/services/ValuationService';
import HttpError from '../../shared/server/utils/HttpError';

// The quick valuation of a catalogue model for buyback, pawn and trade (signed-in customers: B and S are not public).
@Controller('/valuation')
export default class ValuationController extends ApiBaseController {
  private service = new ValuationService();
  @Get('/:productId')
  async valuation(req: Request, res: Response) {
    try {
      if (!req.user) throw HttpError.unauthorized();
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json(await this.service.forProduct(Number(req.params.productId)));
    } catch (error) {
      return this.handleError(res, error, 'Catalogue valuation');
    }
  }
}

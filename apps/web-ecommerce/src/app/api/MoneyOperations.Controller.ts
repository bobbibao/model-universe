import PayOSPayoutService from '../../core/server/services/PayOSPayoutService';
import type { Request, Response } from 'express';
import { Controller } from '../../shared/server/decorators/controller.decorator';
import { Get, Post } from '../../shared/server/decorators/router.decorator';
import ApiBaseController from './ApiBase.Controller';
import MoneyOperationsService from '../../core/server/services/MoneyOperationsService';
import HttpError from '../../shared/server/utils/HttpError';

@Controller('/admin/commerce/money-operations')
export class MoneyOperationsController extends ApiBaseController {
  @Get('/') async list(req: Request, res: Response) {
    try {
      if (!req.user) throw HttpError.unauthorized();
      return res.json(await new MoneyOperationsService().list(req.user.id));
    } catch (error) {
      return this.handleError(res, error, 'Refund queue');
    }
  }
  @Post('/:id/payos/send') async sendPayos(req: Request, res: Response) {
    try {
      if (!req.user) throw HttpError.unauthorized();
      return res.json(
        await new PayOSPayoutService().execute(Number(req.params.id), req.user.id, req.body?.expectedVersion, true),
      );
    } catch (error) {
      return this.handleError(res, error, 'payOS payout');
    }
  }
  @Post('/:id/payos/sync') async syncPayos(req: Request, res: Response) {
    try {
      if (!req.user) throw HttpError.unauthorized();
      return res.json(
        await new PayOSPayoutService().execute(Number(req.params.id), req.user.id, req.body?.expectedVersion, false),
      );
    } catch (error) {
      return this.handleError(res, error, 'payOS reconciliation');
    }
  }
  @Post('/:id/decision') async decide(req: Request, res: Response) {
    try {
      if (!req.user) throw HttpError.unauthorized();
      return res.json(await new MoneyOperationsService().decide(Number(req.params.id), req.user.id, req.body || {}));
    } catch (error) {
      return this.handleError(res, error, 'Refund approval');
    }
  }
}
@Controller('/payments/bank')
export class BankConfirmationController extends ApiBaseController {
  @Post('/confirmation') async confirmation(req: Request, res: Response) {
    try {
      return res.json(
        await new MoneyOperationsService().bankConfirmation(req.body || {}, req.header('x-bank-signature') || ''),
      );
    } catch (error) {
      return this.handleError(res, error, 'Verified bank payout');
    }
  }
}

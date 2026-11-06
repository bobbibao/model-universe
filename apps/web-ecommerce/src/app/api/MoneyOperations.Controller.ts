import PayOSPayoutService from '../../core/server/services/PayOSPayoutService';
import type { Request, Response } from 'express';
import { Controller } from '../../shared/server/decorators/controller.decorator';
import { Get, Post } from '../../shared/server/decorators/router.decorator';
import ApiBaseController from './ApiBase.Controller';
import MoneyOperationsService from '../../core/server/services/MoneyOperationsService';
import HttpError from '../../shared/server/utils/HttpError';
import type { SourcePurpose } from '../../core/server/services/MoneyOperationsService';

const sourcePurpose = (value: unknown): SourcePurpose => {
  if (value !== 'purchase_refund' && value !== 'hold_refund') throw HttpError.badRequest('Unknown refund purpose.');
  return value;
};
const toId = (value: unknown) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw HttpError.badRequest('Invalid id.');
  return id;
};

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
  // Refund to source (src/shared/refund-to-source.ts): preview, then create it; within the automatic limits it is
  // sent at once, otherwise it waits for another reviewer like any refund.
  @Get('/source') async source(req: Request, res: Response) {
    try {
      if (!req.user) throw HttpError.unauthorized();
      return res.json(
        await new MoneyOperationsService().sourcePreview(
          sourcePurpose(req.query.purpose),
          toId(req.query.entityId),
          req.user.id,
        ),
      );
    } catch (error) {
      return this.handleError(res, error, 'Refund source preview');
    }
  }
  @Post('/refund-to-source') async refundToSource(req: Request, res: Response) {
    try {
      if (!req.user) throw HttpError.unauthorized();
      const result = await new MoneyOperationsService().refundToSource(
        sourcePurpose(req.body?.purpose),
        toId(req.body?.entityId),
        { staffId: req.user.id },
      );
      if (!result.operation) throw HttpError.conflict(`REFUND_TO_SOURCE_UNAVAILABLE: ${result.reason}`);
      if (result.auto) await new PayOSPayoutService().submitAutoApproved();
      return this.sendSuccess(
        res,
        { operationId: result.operation.id, automatic: result.auto },
        result.auto ? 'Đã gửi lệnh hoàn về tài khoản đã thanh toán.' : 'Đã tạo yêu cầu hoàn, chờ người khác duyệt.',
      );
    } catch (error) {
      return this.handleError(res, error, 'Refund to source');
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

import { Controller } from '../../shared/server/decorators/controller.decorator';
import { Get, Post, Put } from '../../shared/server/decorators/router.decorator';
import ApiBaseController from './ApiBase.Controller';
import FinanceService from '../../core/server/services/FinanceService';
import type { Request, Response } from 'express';
import HttpError from '../../shared/server/utils/HttpError';

@Controller('/admin/finance')
export default class AdminFinanceController extends ApiBaseController {
  private finance = new FinanceService();
  private actor(req: Request) {
    if (!req.user || req.user.role !== 'ADMIN') throw HttpError.forbidden();
    return req.user.id;
  }
  @Get('/report') async report(req: Request, res: Response) {
    try {
      this.actor(req);
      return res.json(await this.finance.report(req.query));
    } catch (e) {
      return this.handleError(res, e, 'Finance report');
    }
  }
  @Get('/orders') async orders(req: Request, res: Response) {
    try {
      this.actor(req);
      return res.json(await this.finance.orders(req.query));
    } catch (e) {
      return this.handleError(res, e, 'Finance orders');
    }
  }
  @Get('/orders/:id') async order(req: Request, res: Response) {
    try {
      this.actor(req);
      return res.json(await this.finance.order(Number(req.params.id)));
    } catch (e) {
      return this.handleError(res, e, 'Finance order');
    }
  }
  @Post('/orders/:id/reconcile') async reconcile(req: Request, res: Response) {
    try {
      return this.sendSuccess(
        res,
        await this.finance.reconcile(Number(req.params.id), this.actor(req), req.body || {}),
        'Đã lưu phiên bản đối soát.',
      );
    } catch (e) {
      return this.handleError(res, e, 'Finance reconcile');
    }
  }
  @Get('/cost-types') async types(req: Request, res: Response) {
    try {
      this.actor(req);
      return res.json(await this.finance.types());
    } catch (e) {
      return this.handleError(res, e, 'Finance cost types');
    }
  }
  @Post('/cost-types') async createType(req: Request, res: Response) {
    try {
      return this.sendSuccess(
        res,
        await this.finance.saveType(null, this.actor(req), req.body || {}),
        'Đã tạo loại chi phí.',
        201,
      );
    } catch (e) {
      return this.handleError(res, e, 'Finance cost type');
    }
  }
  @Put('/cost-types/:id') async editType(req: Request, res: Response) {
    try {
      return this.sendSuccess(
        res,
        await this.finance.saveType(Number(req.params.id), this.actor(req), req.body || {}),
        'Đã lưu cấu hình chi phí.',
      );
    } catch (e) {
      return this.handleError(res, e, 'Finance cost type');
    }
  }
  @Get('/expenses') async expenses(req: Request, res: Response) {
    try {
      this.actor(req);
      return res.json(await this.finance.expenses(req.query));
    } catch (e) {
      return this.handleError(res, e, 'Finance expenses');
    }
  }
  @Post('/expenses') async expense(req: Request, res: Response) {
    try {
      return this.sendSuccess(
        res,
        await this.finance.postExpense(this.actor(req), req.body || {}),
        'Đã ghi nhận chi phí.',
        201,
      );
    } catch (e) {
      return this.handleError(res, e, 'Finance expense');
    }
  }
  @Post('/expenses/:id/reverse') async reverse(req: Request, res: Response) {
    try {
      return this.sendSuccess(
        res,
        await this.finance.postExpense(this.actor(req), req.body || {}, Number(req.params.id)),
        'Đã đảo bút toán; lịch sử gốc được giữ nguyên.',
      );
    } catch (e) {
      return this.handleError(res, e, 'Finance expense reversal');
    }
  }
}

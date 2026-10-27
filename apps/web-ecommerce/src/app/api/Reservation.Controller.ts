import MoneyOperationsService from '../../core/server/services/MoneyOperationsService';
import PaymentGatewayService from '../../core/server/services/PaymentGatewayService';
import type { Request, Response } from 'express';
import { Controller } from '../../shared/server/decorators/controller.decorator';
import { Get, Post } from '../../shared/server/decorators/router.decorator';
import ApiBaseController from './ApiBase.Controller';
import ReservationService from '../../core/server/services/ReservationService';
import HttpError from '../../shared/server/utils/HttpError';

@Controller('/reservations')
export default class ReservationController extends ApiBaseController {
  private reservations = new ReservationService();
  private user(req: Request) {
    if (!req.user) throw HttpError.unauthorized();
    return req.user.id;
  }
  @Get('/')
  async list(req: Request, res: Response) {
    try {
      return res.json(await this.reservations.list(this.user(req)));
    } catch (error) {
      return this.handleError(res, error, 'Reservations');
    }
  }
  @Get('/notifications')
  async notifications(req: Request, res: Response) {
    try {
      return res.json(await this.reservations.notifications(this.user(req)));
    } catch (error) {
      return this.handleError(res, error, 'Reservation notifications');
    }
  }
  @Get('/:id')
  async detail(req: Request, res: Response) {
    try {
      return res.json(await this.reservations.detail(Number(req.params.id), this.user(req)));
    } catch (error) {
      return this.handleError(res, error, 'Reservation');
    }
  }
  @Post('/:id/dispute')
  async dispute(req: Request, res: Response) {
    try {
      if (!req.user) throw HttpError.unauthorized();
      return this.sendSuccess(
        res,
        await new ReservationService().raiseDispute(Number(req.params.id), req.user.id, req.body || {}),
      );
    } catch (error) {
      return this.handleError(res, error, 'Reservation dispute');
    }
  }
  @Post('/quote') async quote(req: Request, res: Response) {
    try {
      return res.json(await this.reservations.quote(this.user(req), req.body || {}));
    } catch (error) {
      return this.handleError(res, error, 'Hold merchandise quote');
    }
  }
  @Post('/:id/payment-link') async paymentLink(req: Request, res: Response) {
    try {
      return res.json(
        await new PaymentGatewayService().createHoldLink(
          this.user(req),
          Number(req.params.id),
          req.body.amountVnd,
          req.body.locale,
        ),
      );
    } catch (error) {
      return this.handleError(res, error, 'Hold payment link');
    }
  }
  @Post('/:id/sync-payment') async syncPayment(req: Request, res: Response) {
    try {
      return res.json(await new PaymentGatewayService().syncHold(this.user(req), Number(req.params.id)));
    } catch (error) {
      return this.handleError(res, error, 'Verified hold payment');
    }
  }
  @Post('/:id/refund-request') async refund(req: Request, res: Response) {
    try {
      return res.json(
        await new MoneyOperationsService().request(
          'hold_refund',
          Number(req.params.id),
          this.user(req),
          req.body || {},
        ),
      );
    } catch (error) {
      return this.handleError(res, error, 'Hold refund request');
    }
  }
  @Post('/')
  async create(req: Request, res: Response) {
    try {
      return this.sendSuccess(res, await this.reservations.create(this.user(req), req.body || {}), undefined, 201);
    } catch (error) {
      return this.handleError(res, error, 'Reservation request');
    }
  }
  @Post('/:id/delivery')
  async delivery(req: Request, res: Response) {
    try {
      return this.sendSuccess(
        res,
        await this.reservations.requestDelivery(Number(req.params.id), this.user(req), req.body || {}),
      );
    } catch (error) {
      return this.handleError(res, error, 'Reservation delivery');
    }
  }
  @Post('/:id/evidence')
  async evidence(req: Request, res: Response) {
    try {
      return this.sendSuccess(
        res,
        await this.reservations.attachEvidence(Number(req.params.id), this.user(req), req.body?.evidenceIds),
      );
    } catch (error) {
      return this.handleError(res, error, 'Reservation evidence');
    }
  }
  @Post('/:id/cancel-delivery')
  async cancelDelivery(req: Request, res: Response) {
    try {
      return this.sendSuccess(
        res,
        await this.reservations.cancelDeliveryRequest(Number(req.params.id), this.user(req)),
      );
    } catch (error) {
      return this.handleError(res, error, 'Cancel reservation delivery');
    }
  }
  @Post('/:id/cancel')
  async cancel(req: Request, res: Response) {
    try {
      return this.sendSuccess(
        res,
        await this.reservations.cancel(Number(req.params.id), this.user(req), req.body || {}, true),
      );
    } catch (error) {
      return this.handleError(res, error, 'Cancel reservation');
    }
  }
}

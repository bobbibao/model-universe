import type { Request, Response } from 'express';
import { Controller } from '../../shared/server/decorators/controller.decorator';
import { Get, Post } from '../../shared/server/decorators/router.decorator';
import ApiBaseController from './ApiBase.Controller';
import CommerceAccessService from '../../core/server/services/CommerceAccessService';
import HttpError from '../../shared/server/utils/HttpError';

@Controller('/admin/commerce/access')
export default class CommerceAccessController extends ApiBaseController {
  @Get('/') async list(req: Request, res: Response) {
    try {
      if (!req.user) throw HttpError.unauthorized();
      return res.json(await CommerceAccessService.list(req.user.id));
    } catch (error) {
      return this.handleError(res, error, 'Commerce access');
    }
  }
  @Post('/:id') async assign(req: Request, res: Response) {
    try {
      if (!req.user) throw HttpError.unauthorized();
      await CommerceAccessService.assign(req.user.id, Number(req.params.id), req.body.scopes, req.body.reason);
      return res.json(await CommerceAccessService.list(req.user.id));
    } catch (error) {
      return this.handleError(res, error, 'Commerce access assignment');
    }
  }
}

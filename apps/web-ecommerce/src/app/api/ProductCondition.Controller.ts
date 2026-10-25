import type { Request, Response } from 'express';
import { Controller } from '../../shared/server/decorators/controller.decorator';
import { Delete, Get, Post, Put } from '../../shared/server/decorators/router.decorator';
import ApiBaseController from './ApiBase.Controller';
import ProductConditionService from '../../core/server/services/ProductConditionService';
import HttpError from '../../shared/server/utils/HttpError';

// The conditions a unit can be sold in: every active one for the storefront (filters and labels).
@Controller('/product-conditions')
export class ProductConditionController extends ApiBaseController {
  private service = new ProductConditionService();
  @Get('')
  async list(_req: Request, res: Response) {
    try {
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.json(await this.service.all());
    } catch (error) {
      return this.handleError(res, error, 'Product conditions');
    }
  }
}

// Admin > Products > Conditions: add, rename, describe, reorder, retire or remove conditions.
@Controller('/admin/product-conditions')
export default class AdminProductConditionController extends ApiBaseController {
  private service = new ProductConditionService();
  private admin(req: Request) {
    if (!req.user) throw HttpError.unauthorized();
    if (req.user.role !== 'ADMIN') throw HttpError.forbidden();
    return req.user.id;
  }
  @Get('')
  async list(req: Request, res: Response) {
    try {
      this.admin(req);
      return res.json(await this.service.list());
    } catch (error) {
      return this.handleError(res, error, 'Admin product conditions');
    }
  }
  @Post('')
  async create(req: Request, res: Response) {
    try {
      return this.sendSuccess(
        res,
        await this.service.create(this.admin(req), req.body || {}),
        'Đã thêm tình trạng.',
        201,
      );
    } catch (error) {
      return this.handleError(res, error, 'Create a product condition');
    }
  }
  @Put('/:key')
  async update(req: Request, res: Response) {
    try {
      return this.sendSuccess(
        res,
        await this.service.update(this.admin(req), String(req.params.key), req.body || {}),
        'Đã lưu tình trạng.',
      );
    } catch (error) {
      return this.handleError(res, error, 'Update a product condition');
    }
  }
  @Delete('/:key')
  async remove(req: Request, res: Response) {
    try {
      return this.sendSuccess(
        res,
        await this.service.remove(this.admin(req), String(req.params.key)),
        'Đã xoá tình trạng.',
      );
    } catch (error) {
      return this.handleError(res, error, 'Remove a product condition');
    }
  }
}

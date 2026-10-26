import type { Request, Response } from 'express';
import { Controller } from '../../shared/server/decorators/controller.decorator';
import { Delete, Get, Post, Put } from '../../shared/server/decorators/router.decorator';
import ApiBaseController from './ApiBase.Controller';
import CatalogTreeService from '../../core/server/services/catalog/CatalogTreeService';
import ModelFamilyModel from '../../core/server/database/client/models/ModelFamily.Model';
import ProductModel from '../../core/server/database/client/models/Product.Model';
import HttpError from '../../shared/server/utils/HttpError';
import { Op } from 'sequelize';

@Controller('/product-condition-tree')
export class PublicConditionTreeController extends ApiBaseController {
  @Get('')
  async list(_req: Request, res: Response) {
    try {
      res.setHeader('Cache-Control', 'no-cache');
      return res.json(await new CatalogTreeService().nodes());
    } catch (error) {
      return this.handleError(res, error, 'Condition tree');
    }
  }
  @Get('/families')
  async families(req: Request, res: Response) {
    try {
      const q = String(req.query.q ?? '')
        .trim()
        .slice(0, 120)
        .replace(/[\\%_]/g, '\\$&');
      const rows = await ModelFamilyModel.findAll({
        where: {
          partnerId: null,
          ...(q ? { [Op.or]: [{ name: { [Op.iLike]: `%${q}%` } }, { modelCode: { [Op.iLike]: `%${q}%` } }] } : {}),
        },
        attributes: ['id', 'name', 'brandName', 'modelCode', 'scale'],
        order: [['name', 'ASC']],
        limit: 50,
      });
      const published = await ProductModel.findAll({
        attributes: ['modelFamilyId', 'imageUrl'],
        where: {
          modelFamilyId: rows.map((row) => row.id),
          partnerId: null,
          isArchived: false,
          listingStatus: 'published',
          catalogCanonicalId: null,
        },
        order: [['id', 'ASC']],
      });
      return res.json(
        rows.map((row) => ({
          ...row.get({ plain: true }),
          imageUrl:
            published.find((product) => product.modelFamilyId === row.id)?.imageUrl ??
            '/images/product-placeholder.svg',
        })),
      );
    } catch (error) {
      return this.handleError(res, error, 'Model families');
    }
  }
  @Post('/match')
  async match(req: Request, res: Response) {
    try {
      const snapshot = await new CatalogTreeService().snapshot(req.body ?? {});
      // The service picker shows an approved S (already shown by existing service estimates), never cost/supplier.
      return res.json(snapshot);
    } catch (error) {
      return this.handleError(res, error, 'Match condition combination');
    }
  }
}

@Controller('/admin/product-condition-tree')
export default class AdminConditionTreeController extends ApiBaseController {
  private admin(req: Request) {
    if (!req.user) throw HttpError.unauthorized();
    if (req.user.role !== 'ADMIN') throw HttpError.forbidden();
    return req.user.id;
  }
  @Get('')
  async list(req: Request, res: Response) {
    try {
      this.admin(req);
      return res.json(await new CatalogTreeService().list());
    } catch (error) {
      return this.handleError(res, error, 'Admin condition tree');
    }
  }
  @Post('')
  async create(req: Request, res: Response) {
    try {
      return this.sendSuccess(
        res,
        await new CatalogTreeService().save(this.admin(req), req.body ?? {}),
        'Đã thêm nhánh.',
        201,
      );
    } catch (error) {
      return this.handleError(res, error, 'Create condition node');
    }
  }
  @Put('/:id')
  async update(req: Request, res: Response) {
    try {
      return this.sendSuccess(
        res,
        await new CatalogTreeService().save(this.admin(req), req.body ?? {}, Number(req.params.id)),
        'Đã lưu nhánh.',
      );
    } catch (error) {
      return this.handleError(res, error, 'Update condition node');
    }
  }
  @Delete('/:id')
  async remove(req: Request, res: Response) {
    try {
      return this.sendSuccess(
        res,
        await new CatalogTreeService().remove(this.admin(req), Number(req.params.id), req.body?.expectedVersion),
        'Đã xóa nhánh.',
      );
    } catch (error) {
      return this.handleError(res, error, 'Delete condition node');
    }
  }
  @Get('/review')
  async review(req: Request, res: Response) {
    try {
      this.admin(req);
      return res.json(
        await ProductModel.findAll({
          attributes: [
            'id',
            'name',
            'sku',
            'condition',
            'stock',
            'pricingReferenceMemberVnd',
            'pricingReferencePreownedVnd',
          ],
          where: { [Op.or]: [{ modelFamilyId: null }, { catalogReviewRequired: true }] },
          limit: 500,
          order: [['id', 'ASC']],
        }),
      );
    } catch (error) {
      return this.handleError(res, error, 'Legacy catalog review');
    }
  }
}

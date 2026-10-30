import ProductOwnershipService from '../../core/server/services/ProductOwnershipService';
import { ControllerModel } from '../../shared/server/decorators/controllerModel.decorator';
import { Controller } from '../../shared/server/decorators/controller.decorator';
import { Delete, Get, Post, Put } from '../../shared/server/decorators/router.decorator';
import ApiBaseController from './ApiBase.Controller';
import type { Request, Response } from 'express';
import ProductBulkService from '../../core/server/services/ProductBulkService';
import type ProductService from '../../core/server/services/ProductService';
import { apiProductMessage } from '../../shared/server/utils/ApiLocale';
import HttpError from '../../shared/server/utils/HttpError';
import ConditionStockService from '../../core/server/services/catalog/ConditionStockService';
import { parsePagination, toPaginatedPayload } from '../../shared/server/utils/PaginationUtils';
import { toInteger } from '../../shared/server/utils/ValidationUtils';

const parseId = (value: string): number => {
  const id = toInteger(value);
  if (!id || id <= 0) throw HttpError.notFound('Không tìm thấy sản phẩm.');
  return id;
};

@Controller('/admin/products')
@ControllerModel('ProductModel')
export default class AdminProductController extends ApiBaseController {
  @Post('/:id/verify-ownership')
  async ownership(req: Request, res: Response) {
    try {
      if (!req.user) throw HttpError.unauthorized();
      return this.sendSuccess(
        res,
        await new ProductOwnershipService().verify(parseId(req.params.id), req.user.id, req.body || {}),
      );
    } catch (error) {
      return this.handleError(res, error, 'Verify product ownership');
    }
  }
  @Post('/:id/transfer-condition')
  async transferCondition(req: Request, res: Response) {
    try {
      if (!req.user) throw HttpError.unauthorized();
      return this.sendSuccess(
        res,
        await new ConditionStockService().transfer(req.user.id, parseId(req.params.id), req.body ?? {}),
      );
    } catch (error) {
      return this.handleError(res, error, 'Transfer condition stock');
    }
  }
  @Get('/')
  async getProducts(req: Request, res: Response) {
    try {
      const service = await this.requireService<ProductService>();
      const { page, perPage, limit, offset } = parsePagination(req);
      const { rows, count, summary } = await service.listAdmin({
        q: req.query.q as string | undefined,
        groupByModel: req.query.groupByModel === 'true',
        categoryId: toInteger(req.query.categoryId),
        status: req.query.status as string | string[] | undefined,
        sortKey: req.query.sort as string | undefined,
        sortDirection: req.query.direction as string | undefined,
        limit,
        offset,
      });
      const result = toPaginatedPayload(rows, count, page, perPage);
      return res.json({ payload: { ...result.payload, summary } });
    } catch (error) {
      return this.handleError(res, error, "AdminProductController's getProducts");
    }
  }

  // Declared before '/:id' so that it is matched first.
  @Get('/stats')
  async getInventoryStats(_: Request, res: Response) {
    try {
      const service = await this.requireService<ProductService>();
      return res.json(await service.inventoryStats());
    } catch (error) {
      return this.handleError(res, error, "AdminProductController's getInventoryStats");
    }
  }

  @Post('/bulk')
  async bulkUpdate(req: Request, res: Response) {
    try {
      if (!req.user) throw HttpError.unauthorized();
      return this.sendSuccess(res, await new ProductBulkService().update(req.user.id, req.body));
    } catch (error) {
      return this.handleError(res, error, 'Admin product bulk update');
    }
  }

  @Get('/:id')
  async getProduct(req: Request, res: Response) {
    try {
      const service = await this.requireService<ProductService>();
      return res.json(await service.getAdminById(parseId(req.params.id)));
    } catch (error) {
      return this.handleError(res, error, "AdminProductController's getProduct");
    }
  }

  @Post('/')
  async createProduct(req: Request, res: Response) {
    try {
      const service = await this.requireService<ProductService>();
      const product = await service.create(req.body || {}, req.user!.id);
      return this.sendSuccess(res, product, apiProductMessage(req, 'created'), 201);
    } catch (error) {
      return this.handleError(res, error, "AdminProductController's createProduct");
    }
  }

  // A new condition option (pre-owned, incomplete, defective, ...) of the main listing :id.
  @Post('/:id/conditions')
  async createConditionOption(req: Request, res: Response) {
    try {
      const service = await this.requireService<ProductService>();
      const option = await service.createConditionOption(parseId(req.params.id), req.body || {}, req.user!.id);
      return this.sendSuccess(res, option, apiProductMessage(req, 'created'), 201);
    } catch (error) {
      return this.handleError(res, error, "AdminProductController's createConditionOption");
    }
  }

  @Put('/:id')
  async updateProduct(req: Request, res: Response) {
    try {
      const service = await this.requireService<ProductService>();
      const product = await service.update(parseId(req.params.id), req.body || {}, req.user!.id);
      return this.sendSuccess(res, product, apiProductMessage(req, 'updated'));
    } catch (error) {
      return this.handleError(res, error, "AdminProductController's updateProduct");
    }
  }

  @Delete('/:id')
  async deleteProduct(req: Request, res: Response) {
    try {
      const service = await this.requireService<ProductService>();
      const { archived } = await service.remove(parseId(req.params.id));
      return this.sendSuccess(res, { archived }, apiProductMessage(req, archived ? 'archivedHistory' : 'deleted'));
    } catch (error) {
      return this.handleError(res, error, "AdminProductController's deleteProduct");
    }
  }
}

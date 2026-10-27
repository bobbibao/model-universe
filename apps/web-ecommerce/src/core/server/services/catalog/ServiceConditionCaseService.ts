import DatabaseProvider from '../../database/Database.Provider';
import ProductModel from '../../database/client/models/Product.Model';
import ModelFamilyModel from '../../database/client/models/ModelFamily.Model';
import BuybackRequestModel from '../../database/client/models/BuybackRequest.Model';
import PawnContractModel from '../../database/client/models/PawnContract.Model';
import BuybackEventModel from '../../database/client/models/BuybackEvent.Model';
import PawnEventModel from '../../database/client/models/PawnEvent.Model';
import UserModel from '../../database/internal/models/User.Model';
import NotificationDispatchService from '../NotificationDispatchService';
import CatalogTreeService, { combinationKey, lockCatalog } from './CatalogTreeService';
import { normalizeSelection, conditionPath, type ItemTypeKey } from '../../../../shared/condition-tree';
import { catalogPricing } from '../../../../shared/sale-pricing';
import { estimateBuyback } from '../../../../shared/buyback-pricing';
import { estimatePawn } from '../../../../shared/pawn-rules';
import HttpError from '../../../../shared/server/utils/HttpError';

export default class ServiceConditionCaseService {
  async resolve(kind: 'buyback' | 'pawn', id: number, actorUserId: number, data: Record<string, any>) {
    const notices = new NotificationDispatchService();
    const result = await DatabaseProvider.getInstance().transaction(async (transaction) => {
      const actor = await UserModel.findByPk(actorUserId, { transaction });
      if (!actor?.isActive || actor.role !== 'ADMIN') throw HttpError.forbidden();
      await lockCatalog(transaction);
      const row =
        kind === 'buyback'
          ? await BuybackRequestModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
          : await PawnContractModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row?.conditionCase) throw HttpError.notFound('Không có đề xuất tình trạng.');
      if (row.version !== data.expectedVersion)
        throw HttpError.conflict('Yêu cầu vừa thay đổi. Tải lại trước khi duyệt.');
      if (
        kind === 'buyback'
          ? ![
              'submitted',
              'need_more_evidence',
              'quoted',
              'awaiting_item',
              'inspecting',
              'reinspection_requested',
            ].includes(row.status)
          : !['submitted', 'quoted'].includes(row.status)
      )
        throw HttpError.conflict('Không thay tổ hợp sau khi khách đã chấp nhận giao dịch.');
      const details = String(data.details ?? '').trim();
      if (!details || details.length > 2000)
        throw HttpError.badRequest('Ghi lý do duyệt/xử lý đề xuất (tối đa 2000 ký tự).');
      const before = row.conditionCase;
      let resolved = before;
      let status: 'resolved' | 'needs_evidence' | 'rejected';
      if (data.action === 'approve') {
        const tree = new CatalogTreeService();
        const nodes = await tree.nodes(transaction);
        const type = (data.itemTypeKey ?? before.itemTypeKey) as ItemTypeKey;
        let ids: number[];
        try {
          ids = normalizeSelection(data.conditionNodeIds ?? before.conditionNodeIds, nodes, type);
        } catch (error) {
          throw HttpError.badRequest((error as Error).message);
        }
        const source = data.baseProductId
          ? await ProductModel.findOne({ where: { id: Number(data.baseProductId), partnerId: null }, transaction })
          : null;
        const familyId = data.modelFamilyId ?? source?.modelFamilyId ?? before.modelFamilyId;
        const family = familyId
          ? await ModelFamilyModel.findOne({ where: { id: familyId, partnerId: null }, transaction })
          : null;
        if (!family)
          throw HttpError.badRequest('Chọn mẫu có sẵn; nếu là mẫu mới, tạo thông tin mẫu trong danh mục trước.');
        if (family.modelCode !== row.asset.modelCode)
          throw HttpError.conflict('Mã mẫu phải khớp hàng khách gửi. Đối chiếu lại trước khi duyệt.');
        const key = combinationKey(family.id, type, ids);
        let product = await ProductModel.findOne({ where: { combinationKey: key }, transaction });
        if (product) {
          if (
            product.inventoryStatus !== 'available' ||
            product.catalogReviewRequired ||
            !product.targetPriceApprovedAt ||
            !product.serviceReferenceEnabled
          )
            throw HttpError.conflict('Duyệt giá/trạng thái SKU trong danh mục trước.');
          if (data.salePriceVnd != null && Number(data.salePriceVnd) !== product.pricingReferenceMemberVnd)
            throw HttpError.conflict('Tổ hợp đã có giá S. Sửa giá tại sản phẩm nếu cần, không ghi đè khi nhận hàng.');
        } else {
          const base =
            source ??
            (await ProductModel.findOne({
              where: { modelFamilyId: family.id, partnerId: null },
              order: [['id', 'ASC']],
              transaction,
            }));
          if (!base) throw HttpError.badRequest('Mẫu chưa có sản phẩm gốc để kế thừa.');
          let pricing: ReturnType<typeof catalogPricing>;
          try {
            pricing = catalogPricing(Number(data.salePriceVnd));
          } catch (error) {
            throw HttpError.badRequest((error as Error).message);
          }
          const sku = `${base.sku.slice(0, 170)}-${type === 'new' ? 'N' : '2H'}-${key.slice(-10).toUpperCase()}`;
          product = await ProductModel.create(
            {
              ...family.identity,
              sku,
              modelFamilyId: family.id,
              itemTypeKey: type,
              condition: type,
              conditionNodeIds: ids,
              combinationKey: key,
              imageUrl: base.imageUrl,
              stock: 0,
              sold: 0,
              importPrice: 0,
              isArchived: true,
              isFeatured: false,
              listingStatus: 'draft',
              publicationRequiresIntake: true,
              pricingReferenceMemberVnd: pricing.referenceMemberVnd,
              price: pricing.listPriceVnd,
              buybackPriceVnd: pricing.buybackPriceVnd,
              targetPriceApprovedAt: new Date(),
              targetPriceApprovedByUserId: actorUserId,
              listPriceVerified: true,
            },
            { transaction },
          );
        }
        resolved = {
          modelFamilyId: family.id,
          itemTypeKey: type,
          conditionNodeIds: ids,
          labels: ids.map((nodeId) => conditionPath(nodeId, nodes)),
          otherCondition: '',
          productId: product.id,
          salePriceVnd: product.pricingReferenceMemberVnd,
          approvedAt: product.targetPriceApprovedAt!.toISOString(),
          capturedAt: new Date().toISOString(),
        };
        status = 'resolved';
      } else if (data.action === 'request_evidence') status = 'needs_evidence';
      else if (data.action === 'reject') status = 'rejected';
      else throw HttpError.badRequest('Chọn duyệt, yêu cầu bổ sung hoặc từ chối.');
      const patch: Record<string, unknown> = {
        conditionCase: resolved,
        conditionCaseStatus: status,
        conditionCaseReviewNote: details,
        version: row.version + 1,
      };
      if (
        status === 'needs_evidence' &&
        kind === 'buyback' &&
        ['submitted', 'quoted', 'need_more_evidence'].includes(row.status)
      )
        Object.assign(patch, { status: 'need_more_evidence', evidenceRequest: details });
      if (status === 'resolved') {
        Object.assign(patch, { referenceProductId: resolved.productId, referenceCondition: resolved.itemTypeKey });
        if (kind === 'buyback')
          Object.assign(patch, {
            estimate: estimateBuyback(resolved.salePriceVnd, [], { approved: true, conditionMatched: true }),
            preliminaryOffer: null,
            finalOffer: null,
            status:
              row.status === 'inspecting' || row.status === 'reinspection_requested'
                ? 'inspecting'
                : row.status === 'awaiting_item'
                  ? 'awaiting_item'
                  : 'submitted',
          });
        else
          Object.assign(patch, {
            webQuote: estimatePawn(resolved.salePriceVnd, { approved: true, issuesDeclared: false }),
            terms: null,
            status: 'submitted',
          });
      }
      await new CatalogTreeService().remember(before.conditionNodeIds, kind, id, transaction);
      await new CatalogTreeService().remember(resolved.conditionNodeIds, kind, id, transaction);
      if (resolved.productId)
        await new CatalogTreeService().remember(resolved.conditionNodeIds, 'product', resolved.productId, transaction);
      await row.update(patch, { transaction });
      const event = {
        actorUserId,
        action: `condition_case_${status}`,
        details: { before, resolved, details, version: row.version },
      };
      if (kind === 'buyback') await BuybackEventModel.create({ ...event, buybackRequestId: id }, { transaction });
      else await PawnEventModel.create({ ...event, pawnContractId: id }, { transaction });
      await notices.notifyCustomer(
        {
          userId: row.userId,
          kind: `${kind}_condition_case`,
          entityId: id,
          dedupeKey: `${kind}:${id}:condition:${row.version}`,
          details: { status, message: details, conditionCase: resolved },
        },
        transaction,
      );
      return { resolved, status, version: row.version };
    });
    notices.dispatchSoon();
    return result;
  }
}

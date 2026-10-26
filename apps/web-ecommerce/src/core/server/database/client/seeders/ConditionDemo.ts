import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import ProductModel from '../models/Product.Model';
import CatalogIntakeModel from '../models/CatalogIntake.Model';
import BuybackRequestModel from '../models/BuybackRequest.Model';
import BuybackEventModel from '../models/BuybackEvent.Model';
import BuybackPayoutModel from '../models/BuybackPayout.Model';
import PawnContractModel from '../models/PawnContract.Model';
import PawnEventModel from '../models/PawnEvent.Model';
import EvidenceModel from '../models/Evidence.Model';
import UserModel from '../../internal/models/User.Model';
import SupplierModel from '../models/Supplier.Model';
import CategoryModel from '../models/Category.Model';
import DatabaseProvider from '../../Database.Provider';
import CatalogTreeService, { familyIdentity } from '../../../services/catalog/CatalogTreeService';
import ListingQcService from '../../../services/ListingQcService';
import FileStorageService from '../../../services/FileStorageService';
import { loadOwnerCatalog } from './OwnerCatalog';
import { loadCatalogEntries } from './ModelUniverseCatalog';
import { hashPassword } from '../../../../../shared/server/utils/PasswordUtils';
import { catalogPricing } from '../../../../../shared/sale-pricing';
import { estimateBuyback, tierBuyback } from '../../../../../shared/buyback-pricing';
import { estimatePawn } from '../../../../../shared/pawn-rules';
import { LISTING_QC_CHECKS, type ListingQcChecks } from '../../../../../shared/listing-qc';

// Explicit opt-in, deterministic fixtures. Never used by the production/owner catalog seed.
export async function seedConditionDemo() {
  if (!/_(condition_demo|test)$/.test(process.env.DB_NAME ?? ''))
    throw new Error('Condition demo requires an isolated *_condition_demo or *_test database.');
  const tree = new CatalogTreeService();
  await tree.seed();
  const nodes = await tree.nodes();
  const node = (key: string) => nodes.find((value) => value.key === key)!.id;
  const passwordHash = await hashPassword(process.env.CONDITION_DEMO_PASSWORD ?? 'Demo@2026!');
  const [admin] = await UserModel.findOrCreate({
    where: { email: 'admin@condition.demo' },
    defaults: {
      email: 'admin@condition.demo',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Condition Demo',
      role: 'ADMIN',
      isActive: true,
    },
  });
  const [customer] = await UserModel.findOrCreate({
    where: { email: 'customer@condition.demo' },
    defaults: {
      email: 'customer@condition.demo',
      passwordHash,
      firstName: 'Khách',
      lastName: 'Demo',
      role: 'USER',
      isActive: true,
      phone: '0900000001',
    },
  });
  const [supplier] = await SupplierModel.findOrCreate({
    where: { name: 'DEMO · Nguồn hàng kiểm thử' },
    defaults: { name: 'DEMO · Nguồn hàng kiểm thử', isActive: true },
  });
  const [category] = await CategoryModel.findOrCreate({
    where: { slug: 'condition-demo' },
    defaults: { name: 'Mô hình demo tình trạng', slug: 'condition-demo' },
  });
  const catalog = loadOwnerCatalog(),
    media = loadCatalogEntries();
  const brands = [...new Set(catalog.map((row) => row.brand))].slice(0, 6);
  const models = brands.flatMap((brand) => catalog.filter((row) => row.brand === brand).slice(0, 2));
  const root = FileStorageService.getUploadRoot();
  await fs.mkdir(path.join(root, 'products'), { recursive: true });
  const products: ProductModel[] = [];
  for (const [index, model] of models.entries()) {
    const entry = media.find((item) => item.id === model.key);
    const original = entry?.image_url?.startsWith('/images/') ? entry.image_url : '/images/catalog/gundam-unicorn.webp';
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(path.join(process.cwd(), 'public', original));
    } catch {
      bytes = await fs.readFile(path.join(process.cwd(), 'public/images/catalog/gundam-unicorn.webp'));
    }
    const filename = `condition-demo-${index + 1}${path.extname(original) || '.webp'}`;
    await fs.writeFile(path.join(root, 'products', filename), bytes);
    const imageUrl = `/uploads/products/${filename}`;
    const combinations = [
      [],
      [],
      [node('missing-box')],
      [node(index % 3 === 1 ? 'missing-rifle' : index % 3 === 2 ? 'scratch-body' : 'loose-left-arm')],
      [node('missing-box'), node('loose-left-arm')],
    ];
    for (const [variant, ids] of combinations.entries()) {
      const sku = `DEMO-COND-${String(index + 1).padStart(2, '0')}-${variant + 1}`;
      const target =
        index === 0
          ? [1200000, 1000000, 850000, 800000, 700000][variant]
          : Math.max(110000, Math.round((model.memberPriceVnd ?? 1500000) * [1, 0.85, 0.75, 0.7, 0.6][variant]));
      const prices = catalogPricing(target);
      await DatabaseProvider.getInstance().transaction(async (transaction) => {
        if (await ProductModel.findOne({ where: { sku }, transaction })) {
          products.push((await ProductModel.findOne({ where: { sku }, transaction }))!);
          return;
        }
        const values = {
          name: model.name,
          brandName: model.brand,
          modelCode: model.manufacturerSku ?? model.key,
          scale: model.scale,
          categoryId: category.id,
          supplierId: supplier.id,
          description:
            'Dữ liệu DEMO để kiểm tra cây tình trạng và tổ hợp. Ảnh minh họa từ bộ catalog, không phải món hàng thật đang bán.',
          descriptionVi:
            'Dữ liệu DEMO để kiểm tra cây tình trạng và tổ hợp. Ảnh minh họa từ bộ catalog, không phải món hàng thật đang bán.',
          descriptionEn:
            'DEMO fixture for condition combinations. Catalog illustration; not a real item offered for sale.',
          conditionNodeIds: ids,
          itemTypeKey: variant === 0 ? 'new' : 'preowned',
          imageUrl,
          sku,
        };
        const selection = await tree.selection(values, null, transaction);
        const product = await ProductModel.create(
          {
            ...values,
            ...selection,
            stock: 0,
            sold: 0,
            price: prices.listPriceVnd,
            pricingReferenceMemberVnd: target,
            importPrice: Math.round(target * 0.6),
            buybackPriceVnd: prices.buybackPriceVnd,
            targetPriceApprovedAt: index === 10 && variant === 4 ? null : new Date('2026-10-27T00:00:00Z'),
            targetPriceApprovedByUserId: admin.id,
            listPriceVerified: true,
            isArchived: index === 11 && variant === 4,
            listingStatus: 'published',
            isFeatured: variant === 0,
          },
          { transaction },
        );
        await tree.remember(selection.conditionNodeIds, 'product', product.id, transaction);
        const stock =
          index === 0 ? [8, 2, 2, 1, 1][variant] : index % 3 === 1 && variant === 2 ? 0 : 1 + ((index + variant) % 5);
        await CatalogIntakeModel.create(
          {
            productId: product.id,
            sourceType: 'demo_baseline',
            sourceId: sku,
            quantity: stock,
            unitCostVnd: product.importPrice,
            actorUserId: admin.id,
            snapshot: { synthetic: true },
          },
          { transaction },
        );
        await product.update({ stock }, { transaction });
        products.push(product);
      });
    }
  }
  for (const [index, value] of [500000, 500001, 1150000, 1150001].entries()) {
    const sku = `DEMO-COND-BOUNDARY-${value}`;
    let product = await ProductModel.findOne({ where: { sku } });
    if (!product) {
      const base = products[(8 + index) * 5];
      const pricing = catalogPricing(value);
      product = await DatabaseProvider.getInstance().transaction(async (transaction) => {
        const selection = await tree.selection(
          {
            ...familyIdentity(base.get({ plain: true })),
            modelFamilyId: base.modelFamilyId,
            itemTypeKey: 'new',
            conditionNodeIds: [node('dented-box')],
          },
          null,
          transaction,
        );
        const created = await ProductModel.create(
          {
            ...familyIdentity(base.get({ plain: true })),
            ...selection,
            sku,
            imageUrl: base.imageUrl,
            stock: 2,
            sold: 0,
            price: pricing.listPriceVnd,
            pricingReferenceMemberVnd: value,
            buybackPriceVnd: pricing.buybackPriceVnd,
            importPrice: Math.round(value * 0.6),
            targetPriceApprovedAt: new Date(),
            targetPriceApprovedByUserId: admin.id,
            listPriceVerified: true,
          },
          { transaction },
        );
        await tree.remember(selection.conditionNodeIds, 'product', created.id, transaction);
        await CatalogIntakeModel.create(
          {
            productId: created.id,
            sourceType: 'demo_baseline',
            sourceId: sku,
            quantity: 2,
            unitCostVnd: created.importPrice,
            actorUserId: admin.id,
            snapshot: { synthetic: true, priceBoundary: true },
          },
          { transaction },
        );
        return created;
      });
    }
    products.push(product);
  }
  // Requests cover existing combination, new combination, new branch, evidence, trade and repeated receipts.
  const target = products[4];
  const asset = {
    name: target.name,
    modelCode: target.modelCode!,
    version: 'DEMO standard',
    assemblyState: 'unassembled',
    boxCondition: 'Theo tổ hợp đã chọn',
    accessories: 'Theo ảnh kiểm hàng DEMO',
    defects: 'Hồ sơ minh họa nghiệp vụ',
    repairHistory: 'Không ghi nhận; DEMO',
  };
  for (let index = 0; index < 10; index++) {
    const key = `condition-demo-buyback-${index}`;
    if (await BuybackRequestModel.count({ where: { userId: customer.id, requestKey: key } })) continue;
    await DatabaseProvider.getInstance().transaction(async (transaction) => {
      const unknown = index === 0 || index === 1 || index === 8;
      const snapshot = await tree.snapshot(
        {
          modelFamilyId: target.modelFamilyId,
          itemTypeKey: 'preowned',
          conditionNodeIds: index === 1 ? [node('missing-box'), node('missing-shield')] : target.conditionNodeIds,
          otherCondition:
            index === 0
              ? 'Cơ cấu đèn LED nhấp nháy khi xoay phần eo'
              : index === 8
                ? 'Cần gửi thêm ảnh chỗ nứt ở cổ tay'
                : '',
        },
        transaction,
      );
      const completed = index === 5 || index === 6;
      const amount = tierBuyback(target.pricingReferenceMemberVnd!);
      const trade =
        index === 4
          ? {
              revision: 1,
              productId: products[0].id,
              itemPriceVnd: products[0].pricingReferenceMemberVnd!,
              buybackVnd: amount,
              differenceVnd: products[0].pricingReferenceMemberVnd! - amount,
              status: 'ready',
              refundApprovedByUserId: null,
            }
          : null;
      const row = await BuybackRequestModel.create(
        {
          userId: customer.id,
          requestKey: key,
          requestDigest: createHash('sha256').update(key).digest('hex'),
          asset,
          conditionCase: snapshot,
          conditionCaseStatus: unknown
            ? index === 8
              ? 'needs_evidence'
              : 'pending'
            : index === 9
              ? 'rejected'
              : 'resolved',
          referenceProductId: snapshot.productId,
          referenceCondition: 'preowned',
          declaredIssues: [],
          estimate: estimateBuyback(snapshot.salePriceVnd, [], {
            approved: !!snapshot.approvedAt,
            conditionMatched: true,
          }),
          status: completed
            ? 'completed'
            : index === 3
              ? 'inspecting'
              : index === 2
                ? 'quoted'
                : index === 8
                  ? 'need_more_evidence'
                  : index === 4
                    ? 'awaiting_acceptance'
                    : 'submitted',
          preliminaryOffer:
            index === 2 ? { amountVnd: amount, details: 'Báo giá DEMO theo đúng tổ hợp', basis: 'formula' } : null,
          finalOffer:
            completed || index === 4
              ? { amountVnd: amount, details: 'Đã kiểm hàng DEMO, tổ hợp khớp khai báo', basis: 'formula' }
              : null,
          inspection: completed || index === 3 || index === 4 ? 'Kiểm hàng mô phỏng, không phải giao dịch thật.' : null,
          ownershipTransferredAt: completed ? new Date() : null,
          tradeProductId: trade?.productId,
          tradeQuote: trade,
          evidenceRequest: index === 8 ? 'Bổ sung ảnh cận cảnh cổ tay.' : null,
        },
        { transaction },
      );
      await tree.remember(snapshot.conditionNodeIds, 'buyback', row.id, transaction);
      await BuybackEventModel.create(
        {
          buybackRequestId: row.id,
          actorUserId: customer.id,
          action: 'submitted',
          details: { synthetic: true, conditionCase: snapshot },
        },
        { transaction },
      );
      if (completed) {
        await BuybackEventModel.create(
          { buybackRequestId: row.id, actorUserId: customer.id, action: 'accept', details: { synthetic: true } },
          { transaction },
        );
        await BuybackPayoutModel.create(
          {
            buybackRequestId: row.id,
            actorUserId: admin.id,
            amountVnd: amount,
            externalReference: `DEMO-BUYBACK-${row.id}`,
            reason: 'Đối soát giả lập trong database demo',
            direction: 'shop_pays',
          },
          { transaction },
        );
        await CatalogIntakeModel.create(
          {
            productId: target.id,
            sourceType: 'buyback',
            sourceId: String(row.id),
            quantity: 1,
            unitCostVnd: amount + index * 1000,
            actorUserId: admin.id,
            snapshot: { synthetic: true, conditionCase: snapshot },
          },
          { transaction },
        );
        await target.reload({ transaction });
        await target.update({ stock: target.stock + 1 }, { transaction });
        await row.update({ productId: target.id }, { transaction });
      }
      const exampleViews = [
        target.imageUrl,
        '/images/catalog/unicorn-ntd-front.webp',
        '/images/catalog/unicorn-ntd-side.webp',
      ];
      for (const [view, url] of exampleViews.entries()) {
        const bytes = await fs.readFile(
          url.startsWith('/uploads/')
            ? path.join(root, url.slice('/uploads/'.length))
            : path.join(process.cwd(), 'public', url),
        );
        const diskKey = `products/condition-demo-evidence-${row.id}-${view}.webp`;
        await fs.writeFile(path.join(root, diskKey), bytes);
        await EvidenceModel.create(
          {
            ownerUserId: customer.id,
            purpose: 'buyback',
            entityId: row.id,
            diskKey,
            originalName: `DEMO-illustration-${view}.webp`,
            mimeType: 'image/webp',
            sizeBytes: bytes.length,
            sha256: createHash('sha256').update(bytes).digest('hex'),
          },
          { transaction },
        );
        if (completed || index === 3) {
          const inspectionKey = `products/condition-demo-inspection-${row.id}-${view}.webp`;
          await fs.writeFile(path.join(root, inspectionKey), bytes);
          await EvidenceModel.create(
            {
              ownerUserId: admin.id,
              purpose: 'buyback_inspection',
              entityId: row.id,
              diskKey: inspectionKey,
              originalName: `DEMO-inspection-${view}.webp`,
              mimeType: 'image/webp',
              sizeBytes: bytes.length,
              sha256: createHash('sha256').update(bytes).digest('hex'),
            },
            { transaction },
          );
        }
      }
      if (completed)
        await new ListingQcService().record(
          {
            buybackRequestId: row.id,
            product: target,
            reviewerUserId: admin.id,
            attested: Object.fromEntries(LISTING_QC_CHECKS.map((check) => [check, true])) as ListingQcChecks,
            verified: Object.fromEntries(LISTING_QC_CHECKS.map((check) => [check, true])) as ListingQcChecks,
            notes: 'QC DEMO, không dùng làm bằng chứng giao dịch thật.',
          },
          transaction,
        );
    });
  }
  for (let index = 0; index < 4; index++) {
    const key = `condition-demo-pawn-${index}`;
    const existing = await PawnContractModel.findOne({ where: { userId: customer.id, requestKey: key } });
    if (existing) {
      if (String(existing.status) === 'closed') await existing.update({ status: 'returned' });
      continue;
    }
    const snapshot = await tree.snapshot({
      modelFamilyId: target.modelFamilyId,
      itemTypeKey: 'preowned',
      conditionNodeIds: target.conditionNodeIds,
      otherCondition: index === 0 ? 'Cần thẩm định bộ LED độ thêm' : '',
    });
    const terms = {
      appraisalVnd: 700000,
      principalVnd: 350000,
      termDays: 30,
      contractText: 'DEMO · Hợp đồng giả lập cho kiểm tra UI, không phải giao dịch hay phê duyệt chính sách thực.',
      disposalAfterGrace: true,
      policyVersion: 1,
      policy: {
        dailyRateBasisPoints: 3,
        dayCount: 'completed_days',
        rounding: 'floor',
        graceDays: 7,
        interestStopEvent: 'verified_repayment',
      },
    };
    const row = await PawnContractModel.create({
      userId: customer.id,
      requestKey: key,
      requestDigest: createHash('sha256').update(key).digest('hex'),
      asset,
      conditionCase: snapshot,
      conditionCaseStatus: index === 0 ? 'pending' : 'resolved',
      referenceProductId: snapshot.productId,
      referenceCondition: 'preowned',
      webQuote: estimatePawn(snapshot.salePriceVnd, { approved: !!snapshot.approvedAt }),
      status: index === 0 ? 'submitted' : index === 1 ? 'active' : index === 2 ? 'returned' : 'disposed',
      terms: index === 0 ? null : terms,
      contractReference: index === 0 ? null : `DEMO-CONTRACT-${index}`,
      custodyReference: index === 0 ? null : `DEMO-CUSTODY-${index}`,
      custodyAt: index === 0 ? null : new Date(),
      disbursedAt: index === 0 ? null : new Date(),
      dueAt: new Date(Date.now() + 30 * 86400000),
      paidAt: index === 2 ? new Date() : null,
      handbackAt: index === 2 ? new Date() : null,
      disposedAt: index === 3 ? new Date() : null,
    });
    await PawnEventModel.create({
      pawnContractId: row.id,
      actorUserId: admin.id,
      action: 'demo_fixture',
      details: { synthetic: true, note: 'Không có chuyển tiền hoặc tồn bán phát sinh.' },
    });
  }
  return {
    families: new Set(products.map((product) => product.modelFamilyId)).size,
    products: products.length,
    nodes: nodes.length,
    adminEmail: admin.email,
    customerEmail: customer.email,
  };
}

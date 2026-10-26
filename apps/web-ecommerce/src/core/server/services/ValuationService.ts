import ProductModel, { STOREFRONT_VISIBLE } from '../database/client/models/Product.Model';
import HttpError from '../../../shared/server/utils/HttpError';
import { estimateBuyback } from '../../../shared/buyback-pricing';
import { estimatePawn, simulatePawnOwed } from '../../../shared/pawn-rules';
import { memberPrice } from '../../../shared/pricing';
import { type ReferenceCondition } from '../../../shared/sale-pricing';

// The days shown in the pawn interest simulation.
const SIMULATED_DAYS = [7, 15, 30] as const;

// The exact SKU supplies one approved S. Other combinations need their own matched SKU or staff review.
export default class ValuationService {
  async forProduct(productId: number) {
    const product =
      Number.isSafeInteger(productId) && productId > 0
        ? await ProductModel.findOne({ where: { id: productId, partnerId: null, ...STOREFRONT_VISIBLE } })
        : null;
    if (!product) throw HttpError.notFound('Không tìm thấy mẫu trong cửa hàng.');
    const approved = !!product.targetPriceApprovedAt;
    const quote = (condition: ReferenceCondition) => {
      const reference = product.modelFamilyId && product.itemTypeKey === condition && product.serviceReferenceEnabled ? product.pricingReferenceMemberVnd : null;
      const pawn = estimatePawn(reference, { approved });
      return {
        buyback: estimateBuyback(reference, [], { approved, conditionMatched: true }),
        pawn: {
          ...pawn,
          simulation: pawn.amountVnd
            ? SIMULATED_DAYS.map((days) => ({ days, owedVnd: simulatePawnOwed(pawn.amountVnd!, days) }))
            : [],
        },
      };
    };
    const conditions = { new: quote('new'), preowned: quote('preowned') };
    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        slug: product.slug,
        imageUrl: product.imageUrl,
        brandName: product.brandName,
        modelCode: product.modelCode,
        condition: product.condition,
        listPriceVnd: product.price,
        memberPriceVnd: memberPrice(product.price),
      },
      ...(product.itemTypeKey === 'preowned' ? conditions.preowned : conditions.new),
      conditions,
    };
  }
}

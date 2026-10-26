import ProductModel, { STOREFRONT_VISIBLE } from '../database/client/models/Product.Model';
import HttpError from '../../../shared/server/utils/HttpError';
import { estimateBuyback } from '../../../shared/buyback-pricing';
import { estimatePawn, simulatePawnOwed } from '../../../shared/pawn-rules';
import { memberPrice } from '../../../shared/pricing';
import { referencePrice, type ReferenceCondition } from '../../../shared/sale-pricing';

// The days shown in the pawn interest simulation.
const SIMULATED_DAYS = [7, 15, 30] as const;

// The web valuation of a model the shop sells (owner rules of 2026-10-26), in each condition a customer can choose:
// new (from S) and 2hand (from S 2hand, when staff entered one). Each gives the buyback price S − margin and the pawn
// amount C50 (its interest only simulated until legal review); the member price is what a trade item costs. Any other
// unit, or a model the shop does not sell, is priced by staff from the customer's photos.
export default class ValuationService {
  async forProduct(productId: number) {
    const product =
      Number.isSafeInteger(productId) && productId > 0
        ? await ProductModel.findOne({ where: { id: productId, partnerId: null, ...STOREFRONT_VISIBLE } })
        : null;
    if (!product) throw HttpError.notFound('Không tìm thấy mẫu trong cửa hàng.');
    const approved = !!product.targetPriceApprovedAt;
    const quote = (condition: ReferenceCondition) => {
      const reference = product.condition === 'new' ? referencePrice(product, condition) : null;
      const pawn = estimatePawn(reference, { approved });
      return {
        buyback: estimateBuyback(reference, [], { approved }),
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
      ...conditions.new,
      conditions,
    };
  }
}

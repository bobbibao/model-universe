import ProductModel, { STOREFRONT_VISIBLE } from '../database/client/models/Product.Model';
import HttpError from '../../../shared/server/utils/HttpError';
import { estimateBuyback } from '../../../shared/buyback-pricing';
import { estimatePawn, simulatePawnOwed } from '../../../shared/pawn-rules';
import { memberPrice } from '../../../shared/pricing';

// The days shown in the pawn interest simulation.
const SIMULATED_DAYS = [7, 15, 30] as const;

// The web valuation of a model the shop sells (owner rule of 2026-10-26): the customer chooses a catalogue model and
// declares a new unit without issues, and sees the buyback price B, the pawn amount C50 (its interest only simulated
// until legal review) and the member price a trade is computed with. A model in another condition, or one the shop
// does not sell, is priced by staff from the customer's photos.
export default class ValuationService {
  async forProduct(productId: number) {
    const product =
      Number.isSafeInteger(productId) && productId > 0
        ? await ProductModel.findOne({ where: { id: productId, partnerId: null, ...STOREFRONT_VISIBLE } })
        : null;
    if (!product) throw HttpError.notFound('Không tìm thấy mẫu trong cửa hàng.');
    const reference = product.condition === 'new' ? product.pricingReferenceMemberVnd : null;
    const approved = !!product.targetPriceApprovedAt;
    const pawn = estimatePawn(reference, { approved });
    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        slug: product.slug,
        imageUrl: product.imageUrl,
        brandName: product.brandName,
        condition: product.condition,
        listPriceVnd: product.price,
        memberPriceVnd: memberPrice(product.price),
      },
      buyback: estimateBuyback(reference, [], { approved }),
      pawn: {
        ...pawn,
        simulation: pawn.amountVnd
          ? SIMULATED_DAYS.map((days) => ({ days, owedVnd: simulatePawnOwed(pawn.amountVnd!, days) }))
          : [],
      },
    };
  }
}

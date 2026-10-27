import crypto from 'crypto';
import type { Transaction } from 'sequelize';
import ProductModel from '../database/client/models/Product.Model';
import ProductImageModel from '../database/client/models/ProductImage.Model';
import ListingQcReviewModel from '../database/client/models/ListingQcReview.Model';
import { failedQcChecks, LISTING_QC_CHECKS, SYSTEM_QC_CHECKS, type ListingQcChecks } from '../../../shared/listing-qc';

// The listing fields a QC review approves (§13: editing photos, price, SKU or condition voids the review).
const LISTED_FIELDS = [
  'sku',
  'price',
  'pricingReferenceMemberVnd',
  'condition',
  'modelFamilyId', 'itemTypeKey', 'conditionNodeIds',
  'conditionNote',
  'missingAccessories',
  'defects',
  'includedAccessories',
  'boxCondition',
  'assemblyState',
  'imageUrl',
] as const;

export const listingPhotos = async (product: ProductModel, transaction?: Transaction) => [
  product.imageUrl,
  ...(
    await ProductImageModel.findAll({ where: { productId: product.id }, order: [['sortOrder', 'ASC']], transaction })
  ).map((image) => image.url),
];

export const listingDigest = async (product: ProductModel, transaction?: Transaction) =>
  crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        ...Object.fromEntries(LISTED_FIELDS.map((field) => [field, product.get(field) ?? null])),
        photos: (await listingPhotos(product, transaction)).slice(1).sort(),
      }),
    )
    .digest('hex');

export const plainReview = (review: ListingQcReviewModel | null) =>
  review ? { ...review.get({ plain: true }), failed: failedQcChecks(review.checks) } : null;

export default class ListingQcService {
  // Records a review: the reviewer's attestations, with the system checks replaced by what the server verified.
  async record(
    input: {
      buybackRequestId: number;
      product: ProductModel;
      reviewerUserId: number;
      attested: Partial<ListingQcChecks>;
      verified: Partial<ListingQcChecks>;
      notes: string;
    },
    transaction: Transaction,
  ) {
    const checks = Object.fromEntries(
      LISTING_QC_CHECKS.map((check) => [
        check,
        SYSTEM_QC_CHECKS.includes(check) ? input.verified[check] === true : input.attested[check] === true,
      ]),
    ) as ListingQcChecks;
    await ListingQcReviewModel.update(
      { invalidatedAt: new Date(), invalidatedReason: 'superseded' },
      { where: { buybackRequestId: input.buybackRequestId, invalidatedAt: null }, transaction },
    );
    return ListingQcReviewModel.create(
      {
        buybackRequestId: input.buybackRequestId,
        productId: input.product.id,
        checks,
        result: failedQcChecks(checks).length ? 'failed' : 'passed',
        notes: input.notes,
        reviewerUserId: input.reviewerUserId,
        reviewedAt: new Date(),
        listingDigest: await listingDigest(input.product, transaction),
      },
      { transaction },
    );
  }

  // The latest review of a request. A passed review whose listing changed since is voided here.
  async latest(buybackRequestId: number, transaction?: Transaction) {
    return ListingQcReviewModel.findOne({ where: { buybackRequestId }, order: [['id', 'DESC']], transaction });
  }

  // Whether the request has a passed, still valid review of exactly this listing.
  async valid(buybackRequestId: number, product: ProductModel, transaction: Transaction) {
    const review = await this.latest(buybackRequestId, transaction);
    if (!review || review.result !== 'passed' || review.invalidatedAt || review.productId !== product.id) return false;
    if (review.listingDigest === (await listingDigest(product, transaction))) return true;
    await review.update({ invalidatedAt: new Date(), invalidatedReason: 'listing_changed' }, { transaction });
    return false;
  }
}

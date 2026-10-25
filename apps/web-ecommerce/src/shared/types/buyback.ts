import type { BuybackEstimate, BuybackIssue, InspectionComparison } from '../buyback-pricing';
import type { ListingQcCheck, ListingQcChecks } from '../listing-qc';

// need_more_evidence: staff (or the automatic media check) asked for more photos/video before a preliminary quote.
// reinspection_requested: the customer disputes the inspected issues; no final price can be accepted until staff
// answer with a new final offer.
export type BuybackStatus =
  | 'submitted'
  | 'need_more_evidence'
  | 'quoted'
  | 'awaiting_item'
  | 'inspecting'
  | 'awaiting_acceptance'
  | 'reinspection_requested'
  | 'awaiting_payout'
  | 'completed'
  | 'returning'
  | 'cancelled';
export interface BuybackAsset {
  name: string;
  modelCode: string;
  version: string;
  assemblyState: string;
  boxCondition: string;
  accessories: string;
  defects: string;
  repairHistory: string;
}
export interface BuybackOffer {
  amountVnd: number;
  details: string;
  // How the amount was reached: the 2.0 formula, or a manual price with its reason.
  basis?: 'formula' | 'manual';
}
// One revision of a trade quote (§9). D = itemPriceVnd − buybackVnd: > 0 the customer pays, < 0 the shop pays back
// once an admin approves it (`refundApprovedByUserId`). A new final offer is a new revision the customer accepts again.
export interface TradeQuote {
  revision: number;
  productId: number;
  itemPriceVnd: number;
  buybackVnd: number | null;
  differenceVnd: number | null;
  status: 'incomplete' | 'ready' | 'accepted' | 'settled';
  refundApprovedByUserId: number | null;
}
export interface ListingQcReview {
  id: number;
  productId: number;
  checks: ListingQcChecks;
  result: 'passed' | 'failed';
  failed: ListingQcCheck[];
  notes: string;
  reviewerUserId: number;
  reviewedAt: string;
  invalidatedAt: string | null;
  invalidatedReason: string | null;
}
export interface BuybackEvidenceFile {
  id: number;
  originalName: string;
  mimeType: string;
  purpose: string;
}
export interface BuybackRequest {
  id: number;
  userId: number;
  status: BuybackStatus;
  version: number;
  asset: BuybackAsset;
  referenceProductId: number | null;
  referenceProduct: { id: number; name: string; sku: string; priceVnd: number } | null;
  declaredIssues: BuybackIssue[];
  estimate: BuybackEstimate | null;
  inspectedIssues: BuybackIssue[] | null;
  comparison: InspectionComparison | null;
  evidenceRequest: string | null;
  reviewRequest: string | null;
  preliminaryOffer: BuybackOffer | null;
  finalOffer: BuybackOffer | null;
  inboundReference: string | null;
  inspection: string | null;
  ownershipTransferredAt: string | null;
  productId: number | null;
  returnTerms: { details: string; accepted: boolean; tracking: string | null } | null;
  tradeProductId: number | null;
  tradeQuote: TradeQuote | null;
  tradeProduct: { id: number; name: string; sku: string; priceVnd: number; stock: number } | null;
  // Admin only: the latest pre-listing QC review and the linked listing's state.
  qcReview?: ListingQcReview | null;
  listing?: { id: number; sku: string; isArchived: boolean; stock: number } | null;
  createdAt: string;
  payout: {
    amountVnd: number;
    externalReference: string;
    direction: 'shop_pays' | 'customer_pays';
    createdAt: string;
  } | null;
  evidence: BuybackEvidenceFile[];
  inspectionEvidence: BuybackEvidenceFile[];
  events: { id: number; action: string; details: Record<string, unknown>; createdAt: string }[];
}

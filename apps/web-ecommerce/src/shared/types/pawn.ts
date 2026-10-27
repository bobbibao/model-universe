import type { ConditionCaseSnapshot } from '../condition-tree';
import type { BuybackAsset } from './buyback';
import type { PawnEstimate, PawnInterestPolicy } from '../pawn-rules';
import type { PawnDisposalStatement, PawnDisposalSummary } from './pawn-disposal';
export type PawnStatus =
  | 'submitted'
  | 'quoted'
  | 'accepted'
  | 'contract_confirmed'
  | 'in_custody'
  | 'active'
  | 'DUE_GRACE'
  | 'OVERDUE_REVIEW'
  | 'repaid'
  | 'returned'
  | 'cancelled'
  | 'disposed';
export interface PawnTerms {
  conditionCase?: ConditionCaseSnapshot | null;
  conditionCaseReviewNote?: string | null;
  appraisalVnd: number;
  principalVnd: number;
  termDays: number;
  contractText: string;
  disposalAfterGrace: boolean;
  policyVersion: number;
  policy: PawnInterestPolicy;
}
export interface PawnGovernanceRecord {
  by: number;
  at: string;
  reference: string;
  evidenceIds?: number[];
  settlement?: Record<string, unknown>;
}
export interface PawnGovernance {
  identityVerified?: boolean;
  ownershipVerified?: boolean;
  disputed?: boolean;
  documents?: PawnGovernanceRecord;
  resolution?: PawnGovernanceRecord;
  titleTransfer?: PawnGovernanceRecord;
  dispute?: { by: number; at: string; reason: string };
  notice?: {
    servedAt: string;
    eligibleAt: string;
    reference: string;
    by: number;
    dueAt?: string;
    evidenceIds: number[];
  };
  complianceApproval?: PawnGovernanceRecord | null;
  financeApproval?: PawnGovernanceRecord | null;
}
export interface PawnContract {
  operations?: import('./money-operation').MoneyOperation[];
  governance?: PawnGovernance;
  conditionCase?: ConditionCaseSnapshot | null;
  conditionCaseReviewNote?: string | null;
  conditionCaseStatus?: 'pending' | 'resolved' | 'needs_evidence' | 'rejected' | null;
  id: number;
  userId: number;
  status: PawnStatus;
  version: number;
  asset: BuybackAsset;
  referenceProductId?: number | null;
  webQuote?: PawnEstimate | null;
  referenceProduct?: { id: number; name: string; sku: string } | null;
  terms: PawnTerms | null;
  contractReference: string | null;
  contractEvidenceIds: number[];
  custodyAt: string | null;
  custodyReference: string | null;
  disbursedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  handbackAt: string | null;
  disposedAt: string | null;
  disposalSettledAt: string | null;
  disposalStatement: PawnDisposalStatement | null;
  disposal: PawnDisposalSummary | null;
  productId: number | null;
  extensionRequest: {
    id?: string;
    proposedDueAt: string;
    reason: string;
    creditDueVnd?: number;
    projectedDebtVnd?: number;
    ceilingVnd?: number;
  } | null;
  createdAt: string;
  overdue: boolean;
  estimate: {
    principalOutstandingVnd?: number;
    interestOutstandingVnd?: number;
    availableCreditVnd?: number;
    surplusCreditVnd?: number;
    creditAppliedVnd?: number;
    asOf: string;
    days: number;
    interestVnd: number;
    capped: boolean;
    collectedVnd: number;
    remainingVnd: number;
  };
  evidence: { id: number; originalName: string }[];
  events: { id: number; action: string; details: Record<string, unknown>; createdAt: string }[];
  payments: {
    id: number;
    kind: 'disbursement' | 'redemption' | 'extension_credit' | 'credit_refund';
    creditAppliedVnd?: number;
    amountVnd: number;
    principalVnd: number;
    interestVnd: number;
    externalReference: string;
    createdAt: string;
  }[];
}

export interface MoneyOperation {
  id: number;
  purpose: string;
  entityId: number;
  amountVnd: number;
  version: number;
  requestedBy: number;
  status: 'requested' | 'approved' | 'completed' | 'rejected' | 'reconciliation';
  providerReference?: string;
  approvedBy?: number | null;
  completedAt?: string | null;
  createdAt: string;
  details: {
    payout?: { providerId?: string; referenceId: string; transactionId?: string; state: string; checkedAt?: string };
    reason: string;
    accountHash: string;
    account: { bank: string; number: string; holder: string };
    // Refund to source: the payOS-confirmed payments whose single paying account receives this refund.
    source?: { paymentSourceIds: number[]; bankName: string | null; maskedAccount: string; paidVnd: number };
    // Sent without a reviewer under the owner's refund-to-source limits (src/shared/refund-to-source.ts).
    autoApproval?: {
      policy: string;
      perRefundCapVnd: number;
      dailyCapVnd: number;
      autoTodayBeforeVnd: number;
      at: string;
    };
    history: { action: string; at: string; by?: number; reason?: string }[];
  };
}

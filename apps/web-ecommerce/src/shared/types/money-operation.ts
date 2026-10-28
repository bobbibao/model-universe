export interface MoneyOperation {
  id: number;
  purpose: string;
  entityId: number;
  amountVnd: number;
  version: number;
  requestedBy: number;
  status: 'requested' | 'approved' | 'completed' | 'rejected' | 'reconciliation';
  providerReference?: string;
  createdAt: string;
  details: {
    payout?: { providerId?: string; referenceId: string; transactionId?: string; state: string; checkedAt?: string };
    reason: string;
    accountHash: string;
    account: { bank: string; number: string; holder: string };
    history: { action: string; at: string; by?: number; reason?: string }[];
  };
}

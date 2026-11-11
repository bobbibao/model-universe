import { BUYBACK_TIERS_BPS } from '@/shared/buyback-pricing';
import { pawnC50 } from '@/shared/pawn-rules';
import { minimumHoldVnd, reservationDays } from '@/shared/reservation';

// The numbers the service pages quote, computed from the rules that price the requests, so the copy cannot drift
// from what the shop actually applies.
const holdDays = Array.from({ length: 80 }, (_, i) => reservationDays(100, 20 + i)).filter((days) => days > 0);

export const SERVICE_FACTS = {
  // Buyback pays S minus the shop's margin; the smallest margin rate gives the highest share of S.
  sellMaxPercent: 100 - Math.min(...BUYBACK_TIERS_BPS.map((tier) => tier.bps)) / 100,
  pawnPercent: pawnC50(1_000_000) / 10_000,
  holdMinPercent: minimumHoldVnd(100),
  holdMinDays: Math.min(...holdDays),
  holdMaxDays: Math.max(...holdDays),
} as const;

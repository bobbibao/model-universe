# Reservation / hold deposit specification

Effective owner rules: **28 October 2026**, `hold-deposit-2026-10-28`. [Full current operating rules and API](../model-universe/pawn-hold-ledgers.md). Earlier source files are historical evidence, not active configuration.

The basis is integer-VND net merchandise after eligible locked benefits, excluding unconfirmed shipping/COD. Compare integer cross-products, never rounded displayed percentages.

| Confirmed allocated amount | Entitlement                                                     |
| -------------------------- | --------------------------------------------------------------- |
| Below 20%                  | No activation, no stock reservation                             |
| 20%–below 40%              | 10 days                                                         |
| 40%–below 50%              | 15 days                                                         |
| 50%–below 60%              | 25 days                                                         |
| 60%–below 70%              | 30 days                                                         |
| 70%–below 100%             | 45 days                                                         |
| Exactly 100%               | PAID_IN_FULL                                                    |
| Over 100%                  | Block allocation; record actual funds for reconciliation/refund |

Activation requires both verified money and atomic allocation of eligible, ownership-verified available stock. `startedAt` is the successful activation time. Days are elapsed 24-hour intervals. Top-ups crossing tiers use the original start; same-tier top-ups do not extend. The old 50%=15/+5%=10 rule is retired for new holds.

Expiry releases stock exactly once, with a retained money liability. Late receipts, reversed payments, disputes and failed allocations never reactivate a hold. Payment references and request keys are idempotent. Web/onsite sales and holds lock the same stock row.

Customer cancellation with money enters review; no automatic deposit forfeiture. Refund requests need independent Finance approval and provider-confirmed payout. A screenshot or checkbox is not a completed refund. Preserve accepted terms, audit and immutable money ledger. Transfer the deposit to a purchase once only; cancelled purchase orders do not recreate the hold. Deposits are liabilities until purchase completion, not new revenue.

HOLD_DEPOSIT, PURCHASE_DEPOSIT and regulated partner installments are separate products. A 10% purchase prepayment grants no long-duration hold entitlement. Historical accepted contracts retain their terms and require review before new receipts are allocated.

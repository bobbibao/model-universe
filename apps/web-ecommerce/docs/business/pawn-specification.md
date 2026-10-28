# Pawn operating specification

Effective owner rules: **28 October 2026**. [Detailed cash-flow, governance, refund and API contract](../model-universe/pawn-hold-ledgers.md). Historical policy snapshots remain readable and are not retroactively changed.

Per-unit web estimate is `C50 = ROUND(S × 0.5, 0)` using approved actual selling S for the exact SKU/brand/version/condition combination. No web-list R or buyback B basis. Missing/unapproved combinations need manual quotation. Estimates do not finalize a loan before inspection, identity, ownership, bilateral contract and required approvals.

The current owner-authorized operating policy uses **0% interest and no hidden fees** for new quotations. See [MU-PAWN-OPS-20261028](pawn-operating-approval-2026-10-28.md). The historical accrual-engine identifier is retained for compatibility; the zero-rate snapshot is honored in every statement/cash-flow calculation. The previous simulated 0.3% formula is not automatically charged. Real operations require verified custody, identity, ownership, bilateral acceptance and Finance confirmation of actual bank transactions. Internal owner approval is not an outside legal certification.

Interest uses actual cash-flow periods, decimal precision 48 and integer-VND half-up settlement. Confirmed partial repayments reduce principal only from their actual timestamp. Credit movements do not restart accrual. Early redemption uses actual elapsed time; full confirmed redemption stops accrual independently of physical handback.

Extension prepayment equals the positive projected-interest difference between new and old due dates. It is a confirmed interest credit, never principal. Support repeated extensions/receipts, apply credit once at settlement, reconcile/refund excess. Check `P_outstanding + I_projected <= FLOOR(0.8 × V)` **before** deducting credit, both on request and decision.

Schedule T−10/T−5 via deduplicated transactional outbox. Replace/cancel old schedules on due change. At due enter DUE_GRACE for 48h, then OVERDUE_REVIEW. No automatic penalty or liquidation.

Asset disposal requires valid served notice and applicable notice period, independent Compliance and Finance approvals, an authorized Admin decision, no dispute, completed title transfer, intake inspection and separate publication review. Pledged/disputed/unowned assets cannot be published through ordinary product edits. Inventory intake and sale are not automatic consequences of an overdue loan.

Documented customer-accepted disposal allocation remains costs → principal → interest → customer surplus, with verified sale receipts and accepted signed amendments. Partial collections use cash-flow periods. Refunds need independent approval and provider confirmation; retain immutable audit and bank-reference replay protection.

Live email and payOS payout configuration: [operating guide](../model-universe/live-email-payos.md).

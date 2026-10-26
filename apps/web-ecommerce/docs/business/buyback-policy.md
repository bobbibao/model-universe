# Model Universe Buyback policy

Canonical English operational interpretation of the owner's buy-back, trade and pawn pricing. **Since 2026-10-26 the
rule is the three prices from S**, from the owner's specification "Đặc tả ba giá, thu mua theo ngưỡng và QC trước đăng
bán" ([source](source/vi/three-prices-specification.md)). It replaces B17 of 2026-10-25
([source](source/vi/buyback-17-percent-specification.md)) and the tier table of the unified rules v5.0
([source](source/vi/unified-business-rules-v5.md)) for every new request. Earlier evidence:
[policy](source/vi/buyback-policy.md), [specification 2.0](source/vi/buyback-specification.md),
[buyback-policy-v1](source/vi/buyback-policy-v1.md). Open questions stay in the
[decision register](../model-universe/business-requirements.md#9-decision-register).

Principle: right item, right condition, right price. The price shown before inspection is a NOT-FINAL estimate; the
shop records the unboxing, inspects, and the customer accepts, asks for a re-inspection, or declines.

## Prices: the owner enters only S

- **S** – the real selling price of the SKU and version (`product.pricingReferenceMemberVnd`): the only price staff
  enter. Saving it records it as approved (`targetPriceApprovedAt`) by the admin who saves it.
- **R** – the web price, `R = ROUND(S / 0.9)` (`webListPrice`, `src/shared/pricing.ts`): the product's `price`. The
  member code MEMBER10 takes 10% off R and gives back exactly S (`memberPrice(R) = S` for every whole S, tested). Every
  product shows R struck through and S highlighted as the member price; signed-in customers get this month's member code
  claimed and applied in their cart.
- **B** – the shop's margin on a buyback (the workbook's "Giá lời B"), `B = MAX(100,000, ROUND(S × r))` with r = 30%
  for S ≤ 500,000, 20% for 500,000 < S ≤ 1,150,000 and 17% above (`buybackMargin`, `src/shared/buyback-pricing.ts`).
- **Buyback price** = `S − B` (the workbook's column H; `tierBuyback`). The steps at 500,001 and 1,150,001 (B drops
  although S rises, so the price jumps) are the owner's choice. Examples (S → B → price): 500,000 → 150,000 → 350,000;
  500,001 → 100,000 → 400,001; 1,150,000 → 230,000 → 920,000; 1,150,001 → 195,500 → 954,501; 2,000,000 → 340,000 →
  1,660,000; 2,500,000 → 425,000 → 2,075,000; 5,000,000 → 850,000 → 4,150,000. The web showed B as the price until
  2026-10-26 (rule `buyback-tiers-2026-10-26`, a misreading of the workbook); requests quoted under it are quoted again
  under `buyback-margin-2026-10-26`, and migration 52 recomputed the stored buyback prices.
- **C50** – the pawn amount, `C50 = ROUND(S × 50%)` (`pawnC50`, `src/shared/pawn-rules.ts`), no minimum
  (500,001 → 250,001). The 0.3% a day compound interest is shown only as a simulation (`simulatePawnOwed`); nothing is
  charged until legal review (LEGAL_REVIEW_REQUIRED).
- **H** – the recorded buy-in, reconciled with receipts before it counts as cost. It is never recalculated from B or S
  (the workbook of 26/10 fills H with the buyback price S − B; those values were not imported as cost).

Deviation from the specification, by the owner's instruction of 2026-10-26 ("the owner only enters S; everything else
follows by formula"): S counts as approved when entered, so web prices and quotes are public without a separate
approval step (the workbook marks every row "CHỜ DUYỆT").

## Quick valuation and estimates

The service tabs are Buyback (`/services/sell`), Trade (`/services/trade`), Pawn (`/services/pawn`) and Become a
partner; reserve is no longer offered. Each of the first three opens with a basket (`ServiceBasket`,
`GET /api/valuation/:id`, signed-in): the customer adds one or more models the shop sells (`CatalogCombobox`: a list
that opens with popular models and filters as they type) and chooses a condition for each:

- **New** (sealed or opened, complete, no defect): priced from S.
- **2hand** (used and assembled, boxed, complete, no defect or repair): priced from **S 2hand**
  (`product.pricingReferencePreownedVnd`), entered by staff next to S, optional and below S. Without S 2hand the
  shop quotes it. Migration 53 filled a placeholder S 2hand of 70% of S rounded down to 10,000 for every shop product
  (owner request of 2026-10-26: mock values until staff enter real ones), each recorded in the pricing audit
  (`preowned_reference_placeholder`).
- **Other** (anything more complicated) or a model the shop does not sell: the customer describes it with choices and
  one note, and an admin quotes it from the photos.

The customer sees each model's price and the total, not how it is worked out: the buyback price S − B, the pawn amount
C50 (the interest only simulated), or for a trade the shop items at member price minus the buyback prices. Each shop
item in a trade is paired with one of the customer's models. Sending creates one request per model
(`referenceCondition` = `new` or `preowned`), each with at least three photos (and a video for a buyback). The buyback
price is offered only for a catalogue model with an approved S (or S 2hand), no declared issue, S > 100,000 and B < S;
otherwise `manualReview` (`no_reference_price`, `reference_not_approved`, `price_too_low`, `issues_declared`,
`serious_damage`) and an admin prices it. Staff see the breakdown on the request; any amount other than the formula is
a manual price with its reason, which the customer must accept.

Requests quoted under an earlier rule keep it to the end (no retroactive change): B17 (`buyback-17`) or the v5.0 tier
table. Code: `src/shared/buyback-pricing.ts` (`BUYBACK_RULE_VERSION = buyback-margin-2026-10-26`),
`src/shared/sale-pricing.ts` (`catalogPricing(S)`), `src/core/server/services/ValuationService.ts`; tests
`tests/unit/buyback-pricing.test.ts`, `tests/unit/pawn-quote.test.ts`, `tests/unit/sale-pricing.test.ts`,
`tests/db/valuation.test.ts`, `tests/db/buyback.test.ts`.

## Flow and statuses

`submitted` → (`need_more_evidence`) → `quoted` (preliminary) → `awaiting_item` → `inspecting` →
`awaiting_acceptance` ⇄ `reinspection_requested` → `awaiting_payout` → `completed`; or `returning` → `cancelled`.
After `completed`: pre-listing QC → stock intake as a DRAFT listing → publication.

1. The customer picks the catalog model (or none, for a manual valuation), declares every issue, sees the estimate,
   optionally picks a shop item to trade for, uploads photos (front, back, sides, box, accessories laid out, each
   issue) and a video, and ticks the six confirmations.
2. Media check: at least three distinct photos; a missing video or missing issue close-ups move the request to
   `need_more_evidence`. Staff can also ask for more; the customer adds files and the request returns to `submitted`.
3. Staff send the preliminary quote (B by default when it applies, or a manual price with its reason).
4. Remote customers ship only after the shop accepts the request; inbound COD stays unsupported (D9).
5. On arrival staff record the unboxing and inspection (`buyback_inspection` evidence, visible to the customer) and
   list the inspected issues. A final offer cannot be sent without that recording. An issue found at inspection turns
   B into an admin price.
6. The customer accepts, asks for a re-inspection, or declines (return under accepted return terms). Payment happens
   only after acceptance, from a verified payout; ownership transfers with it.

## Trade

A customer can trade the model for a shop item (`tradeProductId`). The request carries a quote revision
(`tradeQuote`): the item's price after the member code (its member price S), the approved buy-back price and
`D = item price − buy-back price` (`tradeDifference`).

- Until the final buy-back price exists the quote is `incomplete` (D unknown). Each final offer is a new revision with
  the item's current price; the customer accepts that revision.
- D > 0: the customer pays D. D < 0: the shop pays |D| back, but only after an admin approves it
  (`approve_trade_refund`); the customer cannot accept before that.
- Settlement records D (or nothing when D = 0) with its verified reference and direction (`buyback_payout.direction`),
  hands the item over and takes it out of stock. The trade credit is not a voucher and earns no points.

## Before listing (QC gate)

A bought-back unit is listed only after the sixteen checks QC01–QC16 of the specification (§12,
`src/shared/listing-qc.ts`, table `listing_qc_review`):

- The server verifies QC01 (physical receipt), QC02 (inspection recording), QC06 (accepted final quote), QC07
  (verified settlement), QC08 (one unit, never taken in), QC10 (approved S) and QC16 (reviewer and time); what the
  reviewer ticks for them is ignored. The reviewer attests the others with notes and evidence.
- Any check not met: the review fails (QC_FAILED). A passed review lets staff take the unit into stock: stock 1, cost =
  the paid buy-back price, the listing still archived (DRAFT).
- Publication is a second check: the review still valid for this exact listing, S approved, a price, exactly one unit
  in stock and at least three real photos; only then the listing is ACTIVE.
- Editing the listing's photos, price, SKU or condition after a review voids it (a digest of those fields is stored
  with the review); the unit needs a new review.
- QC11 holds by construction: R = ROUND(S / 0.9) and MEMBER10 gives back S.

## Not implemented / open

- The margin rates (30% / 20% / 17%), the 100,000 minimum and rounding are code constants, not an admin-editable `pricing_rules` table; changing them is a code
  change with tests.
- Staff permissions are the single ADMIN role; the specification's separate inspector, publisher and cashier roles are
  not modelled (the second-admin rule applies to R approvals only).
- A trade item is handed over outside the order flow (no shipment record is created for it).
- Return-shipping cost allocation after a disagreement stays a recorded agreement (`return_offer`).

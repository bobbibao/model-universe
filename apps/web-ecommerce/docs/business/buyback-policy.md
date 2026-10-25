# Model Universe Buyback policy

Canonical English operational interpretation of the owner's buy-back rules. **Since 2026-10-25 the rule is B17**, from
the owner's specification "Đặc tả thu mua 17%, ba mức giá và kiểm duyệt trước đăng bán"
([source](source/vi/buyback-17-percent-specification.md)), which replaces the tier table of the unified rules v5.0 of
2026-10-20 ([source](source/vi/unified-business-rules-v5.md)) for every new request. Earlier evidence:
[policy](source/vi/buyback-policy.md), [specification 2.0](source/vi/buyback-specification.md),
[buyback-policy-v1](source/vi/buyback-policy-v1.md). Open questions stay in the
[decision register](../model-universe/business-requirements.md#9-decision-register).

Principle: right item, right condition, right price. The price shown before inspection is a NOT-FINAL estimate; the
shop records the unboxing, inspects, and the customer accepts, asks for a re-inspection, or declines.

## Three prices

- **S** – the shop's target selling price of the SKU and version (`product.pricingReferenceMemberVnd`). Staff set it;
  one admin approves it (`targetPriceApprovedAt`, Admin > Pricing approvals). A changed S clears the approval.
- **R** – a real published list price, entered with its proof and approved by a second admin
  (`product_price_approval`). R is never derived from S (no `S ÷ 0.9`). Once approved it becomes the price charged and
  `listPriceVerified` is true.
- **Until R is approved the shop sells at S** (the owner's decision of 2026-10-25): the storefront shows S without a
  member price, and no member or voucher code applies (the profit guard treats the product as having no approved R).
  The owner's catalogue workbook has R empty for every row, so the whole catalogue sells at S after migration
  `2026-10-25-47`.
- **B17** – the buy-back reference: `B17 = ROUND(0.17 × S)` to whole VND, half up (`b17` in
  `src/shared/buyback-pricing.ts`). It is 17% *of* S, not a 17% discount, with no steps at 5, 10 or 20 million.
  Examples: S 1,000,000 → 170,000; 2,000,000 → 340,000; 5,000,000 → 850,000; 5,000,001 → 850,000;
  10,000,000 → 1,700,000; 20,000,000 → 3,400,000.

## Estimate

B17 is offered automatically only when **all** hold: the customer chose a catalog model (a matched SKU), its S is
approved, no issue is declared and no serious damage is reported. Otherwise the estimate is empty and an admin prices
the request (`manualReview`): `no_reference_price`, `reference_not_approved`, `issues_declared`, `serious_damage`.
There is no tier table and no fixed deduction per issue any more. Any amount other than B17 is a manual price with its
reason, which the customer must accept.

Requests quoted under the former rule (`ruleVersion` `buyback-5.0` or older) keep it to the end (no retroactive
change): S minus the quoted tier deduction minus 50,000 VND per issue.

`resaleCandidates(B)` (Admin > Pricing calculator) proposes the smallest S whose B17 is B; S is still approved on its
own merits (cost, market, margin).

Code: `src/shared/buyback-pricing.ts` (`BUYBACK_RULE_VERSION = buyback-17`), `src/shared/sale-pricing.ts`
(`catalogPricing(S)` gives S and its B17), tests `tests/unit/buyback-pricing.test.ts`, `tests/unit/sale-pricing.test.ts`,
`tests/db/buyback.test.ts`, `tests/db/pricing-guard.test.ts`.

## Flow and statuses

`submitted` → (`need_more_evidence`) → `quoted` (preliminary) → `awaiting_item` → `inspecting` →
`awaiting_acceptance` ⇄ `reinspection_requested` → `awaiting_payout` → `completed`; or `returning` → `cancelled`.
After `completed`: pre-listing QC → stock intake as a DRAFT listing → publication.

1. The customer picks the catalog model (or none, for a manual valuation), declares every issue, sees the estimate,
   optionally picks a shop item to trade for, uploads photos (front, back, sides, box, accessories laid out, each
   issue) and a video, and ticks the six confirmations.
2. Media check: at least three distinct photos; a missing video or missing issue close-ups move the request to
   `need_more_evidence`. Staff can also ask for more; the customer adds files and the request returns to `submitted`.
3. Staff send the preliminary quote (B17 by default when it applies, or a manual price with its reason).
4. Remote customers ship only after the shop accepts the request; inbound COD stays unsupported (D9).
5. On arrival staff record the unboxing and inspection (`buyback_inspection` evidence, visible to the customer) and
   list the inspected issues. A final offer cannot be sent without that recording. An issue found at inspection turns
   B17 into an admin price.
6. The customer accepts, asks for a re-inspection, or declines (return under accepted return terms). Payment happens
   only after acceptance, from a verified payout; ownership transfers with it.

## Trade

A customer can trade the model for a shop item (`tradeProductId`). The request carries a quote revision
(`tradeQuote`): the item's price charged (S or approved R), the approved buy-back price and
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
- Deviation from the specification, by the owner's decision of 2026-10-25: QC11 accepts a unit sold at S without an
  approved R (the specification would block publication until R exists).

## Not implemented / open

- The rate (17%) and rounding are code constants, not an admin-editable `pricing_rules` table; changing them is a code
  change with tests.
- Staff permissions are the single ADMIN role; the specification's separate inspector, publisher and cashier roles are
  not modelled (the second-admin rule applies to R approvals only).
- A trade item is handed over outside the order flow (no shipment record is created for it).
- Return-shipping cost allocation after a disagreement stays a recorded agreement (`return_offer`).

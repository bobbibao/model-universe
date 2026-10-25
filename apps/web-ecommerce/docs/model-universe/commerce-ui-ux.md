# Commerce UI/UX — storefront and model admin

Updated 25 October 2026. The latest revision removes redundant admin chrome and restores the product-detail design from before the compact tab experiment.

## Product detail

The admin cleanup revision restored the product detail and offer panel from the parent of commit `efbfaa6`; the restock action update below builds on that layout. This restores the previous gallery and purchase layout, condition cards, inline condition disclosure, expandable benefits, description, specifications and purchase-return dock. The compact storefront tabs and their CSS have been removed. The catalog and existing brand system remain in place.

## Admin workspace

The shared breadcrumb component now supplies only a screen-reader heading. The visible page heading and breadcrumb row have been removed across admin; the global header still identifies the current destination. Obsolete heading styles have also been removed.

The model editor no longer repeats the model photo, name, SKU, price and stock in a summary sidebar, or the extra ID/sold caption. Its form uses the available width. A condition option retains its useful link to the parent listing in a compact notice.

The catalog and inventory statistics remain peer tabs. The editor retains its identity, condition/options, images, pricing, inventory/packaging, descriptions and supplier/display tabs. Draft values survive tab changes. Validation opens the affected tab and focuses its invalid field. Save, discard and delete remain visible in the workspace footer. The creation wizard retains its step validation and navigation.

Catalog, editor and creation workspaces reclaim the space previously reserved for headings. Copilot moves into the existing global header on model pages, with an icon button on narrow screens; it retains its dialog and record context.

## Implementation

`WorkspaceTabs` retains labelled tablists, matching tab/panel IDs, selected state and roving tabindex. Arrow keys, Home and End navigate between retained panels. `compact-workspaces.css` now contains only the shared tabs and admin geometry. Vietnamese and English remain supported.

No dependency, database schema, secret or Google Drive file is changed. Browser fixtures intercept mutations and use a synthetic middleware session; only existing public catalog data is read.

## Verification

Run the local stack with `yarn dev`, then:

```text
yarn e2e e2e/commerce-experience.spec.ts --reporter=list
yarn build
```

The suite covers restored product gallery/cart/purchase-return behavior, admin heading removal, retained drafts, validation, table preferences and the creation wizard in Vietnamese and English. Screenshots are saved under `.artifacts/model-universe/commerce-experience/` and are not committed.

Validation completed: all 18 browser cases passed. The changed UI components passed ESLint, and the optimized Next.js production build (including type checking) passed. Existing lint warnings outside the changed components remain. Desktop and mobile screenshots were visually reviewed. This UI verification does not certify real payments or every admin integration. Deployment remains separate from the local commit and merge.

## Purchase updates — 25 October 2026

Sold-out cards and the purchase area now offer restock notification directly, with authenticated save/cancel and a sign-in return path for guests. One shared subscription request serves the catalog. The automatic timed voucher UI and generation have been removed; existing generated codes are no longer redeemable. Payment plan selection locks at confirmation and remains locked while the payment session is pending, including after reload. The QR dialog shows only the fixed payment; changing the plan requires explicit cancellation and a new checkout.

Verification of these purchase updates: 23 focused unit tests and 3 PostgreSQL QR cases passed, including simultaneous deposit/full requests, immutable plans, explicit cancellation, idempotent payment and stock release. The database cases used a fresh disposable database, removed after the run, with simulated payment/carrier clients. Browser coverage passed for all 26 distinct VI/EN cases (22 on the first run, then the corrected QR fixture and 2 additional promotions cases); the QR cases were rerun on mobile/desktop with reload, close and expiry assertions. The fixture initially returned an incomplete voucher response; correcting the test data resolved those two failures. No real payment was initiated. Updated UI ESLint checks passed. The final optimized Next.js production build (including type checking) and the separate Express TypeScript build both passed. Existing lint warnings outside the changed components remain.

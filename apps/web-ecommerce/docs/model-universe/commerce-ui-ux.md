# Commerce UI/UX — storefront and model admin

Updated 25 October 2026. The latest revision develops the condition comparison and model-management workspace from the supplied commerce references, retaining the Collector Studio brand and compact admin shell.

## Product detail

The gallery stays large and sticky beside the purchase flow on desktop, with the existing zoom, thumbnails and mobile stack. Condition options now use full-width selectable rows: native radio, unit photo, semantic condition badge, short note, actual selling price and stock. The selected unit's complete note, missing accessories and defects remain immediately visible; sold-out options remain selectable and offer restock notification. Selection continues to control the unit ID, gallery, price, quantity limits, shared URL, wishlist and cart.

Description, specifications/accessories and reviews use retained tabs below the gallery and purchase area. This removes the long specifications block from the purchase column without bringing back the rejected whole-page compact tab layout. Reviews, unboxing guidance, benefits, assistant, reservations and the purchase-return dock retain their existing behavior. No shipping, warranty or return promises have been invented to match the reference.

## Admin workspace

The shared breadcrumb component now supplies only a screen-reader heading. The visible page heading and breadcrumb row have been removed across admin; the global header still identifies the current destination. Obsolete heading styles have also been removed.

The model editor no longer repeats the model photo, name, SKU, price and stock in a summary sidebar, or the extra ID/sold caption. A condition option retains its useful link to the parent listing in a compact notice.

The condition tab now starts with a listing table: SKU/photo, condition and disclosed issues, aligned selling/list prices, stock, actual archive/inventory status and a labelled edit action. A current-listing marker identifies the form below. Edit links open the exact unit directly in the condition tab; the current row's edit button focuses its form. Add-condition keeps the existing validation, image upload and API flow. The small stock summary belongs to this tab and sums non-archived listings, including zero-stock conditions; archive rows remain visible in the table. It does not claim warehouse movements or a separate inventory source. On smaller screens it stacks below the table, which scrolls horizontally inside its own labelled region.

The model-level catalog keeps its existing grouping, search, filters, sorting and column preferences. Its condition column now separates each condition's badge, stock count and lowest in-stock selling price, so staff can compare conditions before opening the model.

The catalog and inventory statistics remain peer tabs. The editor retains its identity, condition/options, images, pricing, inventory/packaging, descriptions and supplier/display tabs. Draft values survive tab changes. Validation opens the affected tab and focuses its invalid field. Save, discard and delete remain visible in the workspace footer. The creation wizard retains its step validation and navigation.

Catalog, editor and creation workspaces reclaim the space previously reserved for headings. Copilot moves into the existing global header on model pages, with an icon button on narrow screens; it retains its dialog and record context.

## Implementation

`WorkspaceTabs` retains labelled tablists, matching tab/panel IDs, selected state and roving tabindex. Arrow keys, Home and End navigate between retained panels. `compact-workspaces.css` now contains only the shared tabs and admin geometry. Vietnamese and English remain supported.

Admin theme tokens now have one owner in `admin-workspace.css`, shared with portaled dialogs; competing Collector Studio token declarations have been removed. The purple accent, neutral surfaces and dark theme therefore stay consistent across tables, tabs and dialogs. Storefront condition tokens explicitly retain the light palette even when an admin dark-theme preference is stored.

No dependency, database schema, secret or Google Drive file is changed. Browser fixtures intercept mutations and use a synthetic middleware session; only existing public catalog data is read.

## Verification

Run the local stack with `yarn dev`, then:

```text
yarn e2e e2e/commerce-experience.spec.ts --reporter=list
yarn exec next build --no-lint
```

The suite runs against local port 6050 or the isolated UI preview on 6053 (`E2E_BASE_URL=http://localhost:6053`). It covers condition selection by keyboard, correct cart SKU/price/quantity, zero-stock notification, full issue/accessory disclosure, information tabs, archive-excluding totals, current-unit editing, option links, modal validation and retained drafts at 1440/768/390px in Vietnamese and English. Existing gallery, filters, catalog preferences, creation wizard, restock and QR-lock cases remain. Screenshots are saved under `.artifacts/model-universe/commerce-experience/` and are not committed.

Validation completed for this revision: all 38 browser cases passed in one final run, including public catalog/product reads. The changed UI components and browser specification passed ESLint; the optimized Next.js production build with type checking passed. The build uses `--no-lint` because the existing full-project ESLint plugin throws in `src/shared/client/utils/eventEmitter.ts` (`@typescript-eslint/no-duplicate-enum-values`); this does not replace the successful targeted lint checks. Desktop, tablet and mobile screenshots were visually reviewed in light and dark themes. Testing caught and fixed an absolutely positioned screen-reader table label escaping the mobile scroll region. Existing purchase-return tests now use a genuinely long description and scroll beyond the purchase area, and reload assertions wait for the old DOM to settle before checking persisted table preferences.

The isolated preview runs at `http://localhost:6053/vi`, proxying the already-running API on 6070 after the previous 6050 stack stopped. No duplicate server jobs, data seeding or database migrations were started. Browser mutations are intercepted. This UI verification does not certify real payments or every admin integration; deployment remains separate from the local commit and merge.

## Purchase updates — 25 October 2026

Sold-out cards and the purchase area now offer restock notification directly, with authenticated save/cancel and a sign-in return path for guests. One shared subscription request serves the catalog. The automatic timed voucher UI and generation have been removed; existing generated codes are no longer redeemable. Payment plan selection locks at confirmation and remains locked while the payment session is pending, including after reload. The QR dialog shows only the fixed payment; changing the plan requires explicit cancellation and a new checkout.

Verification of these purchase updates: 23 focused unit tests and 3 PostgreSQL QR cases passed, including simultaneous deposit/full requests, immutable plans, explicit cancellation, idempotent payment and stock release. The database cases used a fresh disposable database, removed after the run, with simulated payment/carrier clients. Browser coverage passed for all 26 distinct VI/EN cases (22 on the first run, then the corrected QR fixture and 2 additional promotions cases); the QR cases were rerun on mobile/desktop with reload, close and expiry assertions. The fixture initially returned an incomplete voucher response; correcting the test data resolved those two failures. No real payment was initiated. Updated UI ESLint checks passed. The final optimized Next.js production build (including type checking) and the separate Express TypeScript build both passed. Existing lint warnings outside the changed components remain.

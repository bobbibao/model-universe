# Commerce UI/UX — 25 October 2026

This change improves the existing Collector Studio identity (purple, lime, warm paper, product photography) and the operations workspace. It adds shopping and staff interactions rather than replacing the brand with a new theme.

## Shopper experience

- Applied filter chips reflect the canonical URL. Removing a chip preserves other filters and resets pagination; clearing filters recovers an empty search. Search drafts remain separate from applied values.
- Product cards have a consistent detail/option action, meaningful responsive image sizes and a photo stage pinned to its aspect-ratio container. This fixes the zero-height photo area observed in browser screenshots and affects catalog, home and sale rails using the shared card.
- Product detail separates the gallery, purchase decision, model description and specifications. Long descriptions no longer interrupt the purchase controls. Member and delivery offer details expand on demand; price and stock remain visible.
- The purchase panel groups quantity, cart and wishlist actions. Successful cart additions have an inline live message and cart link. A floating return control takes users back to the selected condition and quantity; it does not silently add a default option.
- The gallery deduplicates photo URLs, provides scrollable thumbnails and opens a large image dialog. The existing dialog provides focus trapping, Escape and focus restoration; left/right arrows navigate photos while open.
- Existing pricing, condition selection, stock validation, reservations, wishlist, checkout quotes and policy rules remain authoritative. No invented reviews, stock, discounts or shipping promises were added.

## Operations experience

All admin routes inherit the sidebar search and shared workspace styling. Every consumer of `DataTable` inherits column selection, row density, record count, a keyboard-focusable scroll region, sticky column headings and pagination that cannot advance while loading.

Column preferences are keyed by route and column schema; row density is shared across admin tables. These are presentation preferences in local storage. The first column remains available for opening records; a column can additionally declare `essential: true` (the product name does so). Selection stays inside a native disclosure with checkboxes, Escape and outside-click dismissal.

The product list now distinguishes load failures from an empty result, provides retry and clear-filter actions, and ignores stale requests after filters change. Inventory statistics initially show the main totals; detailed breakdowns expand when needed so the list is reachable sooner.

Product create/edit keep their action bar in reach. The edit page adds native section links, labelled sections, a validation summary and focus on invalid fields. The assistant launcher moves above the action bar. Mobile sidebar focus trapping includes the search field, and Escape clears a search without closing the drawer. Toasts leave the header reachable.

## Implementation boundaries

- `src/css/commerce-experience.css` is the final commerce layout layer and reuses the existing storefront and admin tokens. Feature-specific business state styles remain in their existing files.
- New interface text is in the `commerceUX` namespace in both Vietnamese and English.
- Native links, buttons, details, radios, checkboxes, definition lists and the existing modal handle semantics. Reduced-motion preferences are respected by purchase-return scrolling.
- No dependencies, API contracts, database schema, secrets or Drive files change.

## Verification

Run the local stack with `yarn dev`, then:

```text
yarn type-check
yarn e2e e2e/commerce-experience.spec.ts --reporter=list
yarn build
```

The 16 browser tests cover Vietnamese and English, desktop and mobile shopping interactions, gallery focus restoration, duplicate image handling, stock-limited quantity, cart feedback, purchase return, admin density and column persistence, essential columns, sidebar search, editor navigation, and retry after a failed list request. Additional public-data cases inspect catalog and product layouts at 1440, 768 and 390 pixels, including loaded image dimensions and page overflow.

Admin and mutation fixtures intercept browser API calls; they do not create products, orders or other shop records. A public model is read from the local catalog for the server-rendered route. Screenshots are generated under `.artifacts/model-universe/commerce-experience/` (not committed).

Validation for this change includes passing frontend/server TypeScript checks, 16 passing browser tests and a successful optimized Next.js production build. The build reports existing lint warnings in unrelated files (including address-combobox ARIA and pricing-tab ARIA); it does not report warnings in the changed UI files. The Webpack custom-server preview returned a `next-intl` configuration error; the existing Turbopack development command with an isolated build directory served the tested pages successfully.

The built production frontend was also started locally with `next start --hostname 127.0.0.1 --port 6052`. All 43 HTTP render checks passed: admin navigation destinations, product create/edit, an English admin page and the public catalog. These use a synthetic middleware session and do not execute business writes. The route/status evidence is in `.artifacts/model-universe/commerce-experience/production-smoke.json`. This verifies the production frontend render path, not the complete custom Express runtime or backend integrations.

The admin tests exercise the shared shell, product list and product editor with fixtures. They do not certify every admin business workflow or real payment, delivery and agent integrations. Conversion improvement has not been measured by an experiment. Deployment and production release approval remain separate from this UI change.

# Commerce UI/UX — compact model workspaces

Updated 25 October 2026. This revision replaces the long product-detail and admin model forms with screen-sized workspaces while retaining the existing Collector Studio brand.

## Layout decisions

The desktop target is a laptop viewport (1366 × 768 and 1440 × 768), not only a tall external display. Photography occupies the left column; the right column groups identity, price, unit selection, information tabs and the purchase footer. Long information scrolls inside the selected panel. The document and site footer remain accessible; the page does not globally disable scrolling.

Mobile uses a shorter gallery and a purchase bar above the bottom navigation. A ResizeObserver measures that navigation and the purchase bar, including content changes, so the final information remains reachable. Phones still need a short page scroll to inspect the model information; the design does not shrink the entire desktop into unreadable text.

## Product detail

- The information tabs contain specifications, unit condition, description and image credits, offers, and reviews. Default specifications use compact label/value rows.
- Price, selected unit, quantity, cart feedback, wishlist and reservation stay outside the information panels. A partner listing keeps its seller-store link visible beside the model heading. Long titles remain readable in their own bounded area and through the title tooltip.
- A native unit picker includes condition, price, availability and SKU. Defect/missing-part counts remain explicit beside it; selecting an affected unit opens its condition details. The full condition note, disclosed issues, accessories and unboxing guidance remain available.
- Description length and review pagination do not move the purchase controls out of the desktop workspace. Review drafts and panel scroll position survive tab changes.
- The existing image dialog preserves Escape, focus restoration and arrow-key image navigation. Duplicate image URLs are removed.
- An inline assistant action remains available; the duplicate floating launcher is hidden on this page so it cannot cover reservation or purchase controls.
- Reservation request identity also includes the selected unit, preventing a previous unit's request key being reused when quantity is unchanged.

## Admin model catalog

The catalog and inventory statistics are peer tabs. Search, filters, table density, column selection and pagination stay in one workspace. Rows scroll inside the table; the pagination footer stays visible. Switching to statistics preserves catalog filters and table preferences.

The editor has a model summary beside retained form tabs: basic identity, condition/options, images, pricing, inventory/packaging, descriptions, and supplier/display settings. Save, discard and delete remain in the workspace footer. Validation opens the tab containing the first invalid field, marks affected tabs with counts and focuses its invalid control (or the panel for grouped validation). Unsaved values and pending image objects survive tab changes.

The create wizard retains its step validation, with an independently scrollable form body, visible navigation actions and focus on invalid fields. Copilot is inline beside the title on list/create/edit pages, keeping the footer unobstructed.

## Shared implementation

`WorkspaceTabs` provides labelled tablists, matching tab/panel IDs, selected state and roving tabindex. Arrow keys wrap between tabs; Home/End select the first/last. Panels remain mounted, allowing instant activation and retaining form state. This follows the [W3C WAI-ARIA tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).

`compact-workspaces.css` scopes the screen geometry to these workspaces and reuses existing tokens. New text is present in Vietnamese and English. Price, promotion, stock, checkout and backend policy calculations retain their existing sources; tabs do not introduce independent business rules.

No dependency, database schema, secret, or Google Drive file is changed.

## Verification

Run the local stack with `yarn dev`, then:

```text
yarn type-check
yarn e2e e2e/commerce-experience.spec.ts --reporter=list
yarn build
```

The browser suite includes 24 cases covering both languages, laptop/mobile viewports, keyboard tabs, gallery navigation and focus, quantity limits, selected-unit cart identity, long descriptions, explicit defect disclosure, partner identity, retained admin drafts, validation in an inactive tab, dense catalog rows, table preferences, create-wizard state and real public catalog/product data at 1440, 768 and 390 pixels.

Validation completed: the full 22-case suite passed before the final seller addition; six focused tab/seller regression cases then passed, and both seller cases were rerun with the no-shop-vouchers assertion. All 24 distinct browser cases have passing coverage. ESLint on the changed UI components, the optimized Next.js production build and the compiled Express server TypeScript build passed. Existing lint warnings outside the changed components remain.

The production frontend also passed 43 HTTP render checks across admin destinations, model create/edit, an English admin page and the public catalog. Evidence is in `.artifacts/model-universe/commerce-experience/production-smoke.json`. This checks the built frontend render path, not deployment of the complete Express/API stack.

Browser fixtures intercept mutations and use a synthetic middleware session. They do not create orders or modify catalog records. Only public data is read from the local catalog. Screenshots are under `.artifacts/model-universe/commerce-experience/` and are not committed.

Passing viewport checks apply to the tested sizes; unusually short screens, large text and long content retain scrolling rather than clipping controls. This UI verification does not certify every admin workflow or real payment, delivery and agent integrations. Conversion improvement has not been measured by an experiment. Deployment remains separate from the local commit and merge.

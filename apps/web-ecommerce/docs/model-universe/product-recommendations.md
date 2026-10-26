# Related models on product detail

The bottom of each product page offers up to four related, currently sellable models. This is content-based discovery, not personalized recommendations or a claim that customers bought the items together. The layout uses the shared product card, a quiet reason label and a manual swipe/scroll shelf on mobile. It does not autoplay or interrupt purchase actions.

## Eligibility and ranking

`GET /api/products/:id/recommendations` accepts the same id/UUID/slug as product detail. A condition option resolves to its main listing. Both the reference and candidates must satisfy the existing storefront visibility policy. A candidate must have positive stock in at least one visible, published, available condition. The API returns the existing public card projection, including current discounts and aggregate stock; internal cost, supplier, received-date and pricing-approval fields stay private.

The service reuses the catalog's eligible-listing lookup, then reads at most 72 main listings ordered by category/brand/scale affinity, real sales and stable id. The ranker uses current available-condition prices, category (40), brand (25), scale (18), name-token overlap (up to 18), logarithmic price proximity (up to 12), assembly state (4) and bounded sales proof (up to 3). Missing attributes earn no match. It excludes the reference id, repeated ids and duplicate normalized brand/model-code families, including the reference family. Ties use ascending id; up to four results are returned without random shuffling. A sparse catalog can return fewer or no suggestions. Popularity never outranks a strong product-context match by itself.

Each card explains its strongest applicable criterion: same category, brand, scale, similar price, or neutral discovery. Price proximity compares current catalog sale quotes, including available condition options; it does not invent an additional promotion. Checkout remains the authority for price and available stock.

## Loading and failure behavior

The browser requests suggestions when the section approaches the viewport (400px margin). It aborts on navigation/unmount and after eight seconds. Empty results or network/API failure hide this optional section without toasts or blocking purchase controls. A new main listing remounts the section, preventing stale results. The request needs no user profile, consent tracking or purchase-history join. There is no schema migration, background job, external recommendation service or new catalog data.

The main purchase actions retain their prominence. Ask-assistant and reserve actions share a compact row of secondary text buttons with 44px targets; the existing sign-in redirect, selected unit, quantity, request idempotency and busy/sold-out guards remain.

## Design reference and limits

Related and complementary recommendations serve different goals; this implementation starts with related alternatives because catalog identity and current availability are reliable inputs. Reference: [Shopify related-product guidance](https://shopify.dev/docs/storefronts/themes/product-merchandising/recommendations/related-products). It does not claim Shopify's algorithms, conversion uplift, collaborative filtering or machine learning. The bounded candidate pool can omit lower-affinity products outside its 72 rows; larger catalogs should evaluate retrieval quality and query performance before changing that limit.

The Admin conditions column now shows only condition badges and available-condition prices. Per-condition quantity (`catalog-condition-stock`) and sold-out captions are removed. Total sellable stock remains in its dedicated sortable column.

## Verification · 26 October 2026

Production Next build (`--no-lint`) including type checks and server TypeScript compile passed. Scoped ESLint reported no errors (the API client retains its existing unused catch-variable warnings). Seven ranker unit tests passed. One PostgreSQL integration scenario on a dedicated disposable `_test` database verified public route/key resolution, visibility and condition-stock eligibility, private-field exclusion and 404 behavior. Sixteen relevant browser checks passed across VI/EN and desktop/mobile; six recommendation/action checks passed again after the final cache/label adjustment. Coverage includes manual mobile scrolling, empty/failing optional API, preserved sign-in redirect for reservations, compact actions, uniform cards and the simplified Admin conditions column.

A browser smoke check against the existing catalog rendered four real recommendations and the compact secondary actions. Its browser API writes were blocked. The preview's dedicated recommendation handler uses database connections forced to read-only and registers models without migrations, seeds or background jobs; the original app server/workspace is untouched. This is local preview verification, not deployment or a conversion-performance measurement.

/**
 * A product's category, from the platform's one shared list (2026-10-04).
 *
 * Product rows carry `categories: ProductCategoryRef[]` — 1 to 5, in the
 * vendor's order, `[0]` the primary. `[]` is allowed on data the backend has
 * not converted yet and means "no category", not an error. The old single
 * `category` string is deprecated and only ever holds `categories[0].name`.
 *
 * See api-doc/FRONTEND-CHANGELOG-product-categories.md.
 */
export interface ProductCategoryRef {
  id: string;
  name: string;
  slug: string;
}

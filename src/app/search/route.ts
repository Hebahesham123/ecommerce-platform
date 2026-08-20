// Some themes' search forms / JS navigate to a bare "/search?q=…" without the
// storefront mount prefix, which would 404. Redirect it to the mounted public
// storefront search, preserving the query. (There is no admin "/search" route.)
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const url = new URL(req.url);
  return Response.redirect(new URL(`/shop/search${url.search}`, url), 307);
}

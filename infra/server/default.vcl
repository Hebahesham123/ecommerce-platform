vcl 4.1;
# Page cache in front of the website. It follows the site's own Cache-Control labels:
# store pages marked "public, s-maxage=30, stale-while-revalidate=300" are shared for 30 s and
# served instantly while refreshing for 5 min. Anything no-store (admin, account, cart, API)
# passes straight through. Requests with cookies or a login token are never shared (Varnish's
# built-in rules), which matches the site's "Vary: Cookie".
backend default {
  .host = "web";
  .port = "3000";
  .connect_timeout = 5s;
  .first_byte_timeout = 120s;
}

sub vcl_recv {
  # Build files are the same for everyone and named by content hash.
  if (req.url ~ "^/_next/static/") {
    unset req.http.Cookie;
  }
}

sub vcl_backend_response {
  if (bereq.url ~ "^/_next/static/") {
    set beresp.ttl = 365d;
  }
}

sub vcl_deliver {
  if (obj.hits > 0) {
    set resp.http.X-Cache = "HIT";
  } else {
    set resp.http.X-Cache = "MISS";
  }
  unset resp.http.Via;
  unset resp.http.X-Varnish;
}

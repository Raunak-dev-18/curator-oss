import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import {
  DOMAIN_HOST_HEADER,
  DOMAIN_PATH_HEADER,
  DOMAIN_PROBE_PATH,
  domainProbeBody,
  hostnameFromHeader,
  isAppHostname,
  isCustomDomainRoutingEnabled,
} from "@/lib/domains";

function requestHostname(request: NextRequest) {
  return (
    hostnameFromHeader(request.headers.get("x-forwarded-host")) ||
    hostnameFromHeader(request.headers.get("host")) ||
    hostnameFromHeader(request.nextUrl.host)
  );
}

export async function proxy(request: NextRequest) {
  const hostname = requestHostname(request);

  // Lets domain verification confirm that a hostname's traffic actually reaches this server.
  if (request.nextUrl.pathname === DOMAIN_PROBE_PATH) {
    return new NextResponse(domainProbeBody(hostname), {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  // A request that arrives on an attached customer domain only ever serves that published app,
  // never the builder, its API, or an Auth0 session.
  if (isCustomDomainRoutingEnabled() && !isAppHostname(hostname)) {
    const requestedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const url = request.nextUrl.clone();
    url.pathname = `/domain/${encodeURIComponent(hostname)}`;
    url.search = "";
    const headers = new Headers(request.headers);
    headers.set(DOMAIN_HOST_HEADER, hostname);
    // Deep links such as /pricing?plan=pro open the same page inside the published app.
    headers.set(DOMAIN_PATH_HEADER, requestedPath);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // `/domain/*` is internal: it only renders through the rewrite above, never by direct request
  // on the builder host, where a client could otherwise spoof the routing headers.
  if (request.nextUrl.pathname.startsWith("/domain/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/_cognix-not-found";
    url.search = "";
    return NextResponse.rewrite(url);
  }

  if (!auth0) return NextResponse.next();
  return auth0.middleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};

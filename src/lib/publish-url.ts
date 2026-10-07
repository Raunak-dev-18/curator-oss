function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export function requestOrigin(request: Pick<Request, "headers" | "url">) {
  const requestUrl = new URL(request.url);
  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const forwardedProtocol = firstForwardedValue(request.headers.get("x-forwarded-proto"));
  if (forwardedHost) {
    const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : requestUrl.protocol.replace(":", "");
    try {
      return new URL(`${protocol}://${forwardedHost}`).origin;
    } catch {
      // Fall back to the URL Next.js resolved for this request.
    }
  }
  return requestUrl.origin;
}

export function publishedAppUrl(request: Pick<Request, "headers" | "url">, slug: string) {
  return new URL(`/publish/${slug}`, requestOrigin(request)).toString();
}

/**
 * Normalizes a visitor-requested path so it can be forwarded into the published app.
 * Only same-origin relative paths survive; anything else falls back to the app root.
 */
export function safeAppPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  try {
    const parsed = new URL(value, "http://cognix.invalid");
    if (parsed.origin !== "http://cognix.invalid") return "/";
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/";
  }
}

/** Points the published app frame at the same path and query the visitor requested. */
export function publishedFrameUrl(runtimeUrl: string, requestedPath: string | null | undefined) {
  const target = new URL(runtimeUrl);
  const requested = new URL(safeAppPath(requestedPath), "http://cognix.invalid");
  target.pathname = requested.pathname;
  // Keep any query parameters the runtime URL needs (for example a signed token) and add the visitor's.
  requested.searchParams.forEach((value, key) => {
    if (!target.searchParams.has(key)) target.searchParams.append(key, value);
  });
  return target.toString();
}

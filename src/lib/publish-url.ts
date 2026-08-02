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

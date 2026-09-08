function stripPort(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  // IPv6 in brackets: [::1]:1234
  const bracketMatch = v.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketMatch) return bracketMatch[1];
  // IPv4: 1.2.3.4:1234
  const ipv4Port = v.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  if (ipv4Port) return ipv4Port[1];
  return v;
}

/**
 * Best-effort client IP detection from request headers.
 * IMPORTANT: Only as trustworthy as your reverse proxy configuration.
 */
export function getClientIpFromHeaders(headers) {
  const get = (k) => {
    try {
      return headers?.get ? headers.get(k) : headers?.[k];
    } catch {
      return null;
    }
  };

  // Common proxy headers (first IP in x-forwarded-for is the original client).
  const xff = get("x-forwarded-for");
  if (xff) {
    const first = String(xff).split(",")[0]?.trim();
    const ip = stripPort(first);
    if (ip) return ip;
  }

  const xrip = stripPort(get("x-real-ip"));
  if (xrip) return xrip;

  const cf = stripPort(get("cf-connecting-ip"));
  if (cf) return cf;

  const fly = stripPort(get("fly-client-ip"));
  if (fly) return fly;

  return null;
}


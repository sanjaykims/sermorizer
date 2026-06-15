/** @type {import('next').NextConfig} */

// Defense-in-depth response headers.
// CSP notes:
// - script-src and style-src deliberately allow 'unsafe-inline' because Next's
//   App Router injects inline hydration scripts and styles; a stricter policy
//   without a nonce-wired layout would break hydration. The iframe sandbox
//   below — sandbox="" on the preview, opaque-origin blob URL on the book
//   popup — is the actual defence against model-injected scripts in stored
//   summary HTML.
// - connect-src 'self' is enough because every external API call (Anthropic,
//   Supabase) happens server-side; the browser only talks to /api/* on this
//   origin. Push subscriptions go to the user's chosen push service, which
//   the browser handles via the Service Worker (not subject to the page CSP).
// - img-src includes data: and blob: because generated summaries embed images
//   as base64 data: URIs and the book popup is rendered from a Blob URL.
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "frame-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
];

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
];

const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

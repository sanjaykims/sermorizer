/** @type {import('next').NextConfig} */

// Defense-in-depth response headers. We deliberately omit script-src/style-src
// (Next's App Router injects inline hydration scripts; a strict policy without
// nonce wiring would break the app). The directives below are safe and still
// valuable: they block framing/clickjacking, plugin objects, base-tag
// hijacking, and cross-origin form posts.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

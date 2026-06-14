/* The VAPID *public* key is safe to ship to the browser — it's how the client
   subscribes to web-push. The matching private key lives only in the server
   env var VAPID_PRIVATE_KEY. Override the public key with
   NEXT_PUBLIC_VAPID_PUBLIC_KEY if you ever rotate the pair. */
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
  "BAzzHiNmSatKDvfuQC40FUNI1re1h2cwQ6rJdcevRye_iYIYoaKPfu0AnidtTTa75eGQtfCsltWvSSIifc6W9RU";

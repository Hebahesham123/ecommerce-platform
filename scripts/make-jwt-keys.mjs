// Generates the secret and the two API keys for the self-hosted database (PostgREST).
// Run on your own computer:   node scripts/make-jwt-keys.mjs
// Then put JWT_SECRET in the server's /opt/store/.env, and the two keys in Vercel.
// Never commit or share the output.
import { createHmac, randomBytes } from "node:crypto";

const secret = process.argv[2] || randomBytes(48).toString("base64url");
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

function sign(payload) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

const iat = Math.floor(Date.now() / 1000);
const exp = iat + 10 * 365 * 24 * 3600; // 10 years

console.log("\n# Server: /opt/store/.env");
console.log(`JWT_SECRET=${secret}`);
console.log("\n# Vercel: environment variables");
console.log(`SUPABASE_SERVICE_ROLE_KEY=${sign({ role: "service_role", iss: "store", iat, exp })}`);
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${sign({ role: "anon", iss: "store", iat, exp })}`);
console.log();

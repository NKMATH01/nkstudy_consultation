import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const lines = env.split("\n");
const url = lines.find(l => l.startsWith("NEXT_PUBLIC_SUPABASE_URL=")).split("=")[1].trim();
const anonKey = lines.find(l => l.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")).split("=")[1].trim();
const serviceKey = lines.find(l => l.startsWith("SUPABASE_SERVICE_ROLE_KEY=")).split("=")[1].trim();

const projectRef = url.match(/https:\/\/(\w+)\./)?.[1];
console.log("URL project ref:", projectRef);

function decode(jwt) {
  const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString());
  return payload;
}

const anonPayload = decode(anonKey);
const servicePayload = decode(serviceKey);

console.log("\n=== anon key payload ===");
console.log(JSON.stringify(anonPayload, null, 2));
console.log("→ ref 일치:", anonPayload.ref === projectRef ? "✅" : `❌ (${anonPayload.ref})`);
console.log("→ exp:", new Date(anonPayload.exp * 1000).toISOString());

console.log("\n=== service_role key payload ===");
console.log(JSON.stringify(servicePayload, null, 2));
console.log("→ ref 일치:", servicePayload.ref === projectRef ? "✅" : `❌ (${servicePayload.ref})`);
console.log("→ exp:", new Date(servicePayload.exp * 1000).toISOString());

// iat 비교 (언제 발급됐는지)
console.log("\n=== 발급 시점 비교 ===");
console.log("anon iat:", new Date(anonPayload.iat * 1000).toISOString());
console.log("service iat:", new Date(servicePayload.iat * 1000).toISOString());
console.log("같은 시점 발급:", anonPayload.iat === servicePayload.iat ? "✅" : "❌ (다른 secret으로 서명됐을 가능성)");

const url = "https://nkstudy-consultation.vercel.app/api/cron/recordings";
const start = Date.now();
for (let i = 0; i < 40; i++) {
  const res = await fetch(url, { redirect: "manual", cache: "no-store" });
  const s = res.status;
  console.log(`${Math.round((Date.now() - start) / 1000)}s HTTP ${s}${s >= 300 && s < 400 ? " → " + res.headers.get("location") : ""}`);
  if (s === 401) process.exit(0);
  await new Promise((r) => setTimeout(r, 15000));
}
process.exit(1);

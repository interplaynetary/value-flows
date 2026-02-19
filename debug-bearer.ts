// Debug script for Bearer Auth
const envText = await Bun.file(".env").text();
const env: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const [k, v] = line.split("=");
  if (k && v) env[k.trim()] = v.trim();
}

const TOKEN = env.AIP_TOKEN;
const HV_URL = env.HAPPYVIEW_URL;

console.log("Token:", TOKEN ? TOKEN.substring(0, 10) + "..." : "MISSING");
if (!TOKEN) process.exit(1);

async function testRequest(path: string) {
  const url = `${HV_URL}${path}`;
  console.log(`\nGET ${url}`);
  
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TOKEN}`
    }
  });
  
  console.log(`Status: ${res.status}`);
  console.log(`Headers:`, Object.fromEntries(res.headers));
  console.log(`Body: ${await res.text()}`);
}

await testRequest("/admin/admins");
await testRequest("/admin/stats");

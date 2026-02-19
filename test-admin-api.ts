import { createHash } from "crypto";

const HAPPYVIEW_URL = "https://happyview-production.up.railway.app";
const AIP_URL = "https://aip-production-0438.up.railway.app";
// Use the user's DID from previous context
const MY_DID = "did:plc:jakdfmodsnsb2bmfw2l3cuwd"; 

// --- Helpers ---
function generateRandomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = createHash("sha256").update(verifier).digest();
  return hash.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// --- Main Flow ---
async function main() {
  console.log("=== Strict Admin API Test (Bearer Only) ===");

  // 1. Register Client
  const redirectUri = "http://127.0.0.1:19288/callback";
  console.log("\n1. Registering Client...");
  const regRes = await fetch(`${AIP_URL}/oauth/clients/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "native",
      client_name: "HappyView Debug Client",
    }),
  });
  
  if (!regRes.ok) throw new Error(`Registration failed: ${await regRes.text()}`);
  const { client_id } = await regRes.json();
  console.log(`   Client ID: ${client_id}`);

  // 2. Authorize
  const codeVerifier = generateRandomString(32);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(16);

  const authorizeUrl = new URL(`${AIP_URL}/oauth/authorize`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", client_id);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "atproto");
  authorizeUrl.searchParams.set("login_hint", MY_DID);

  console.log(`\n2. Authorize URL (Open this in browser):`);
  console.log(authorizeUrl.toString());

  // Start listener
  let resolveCode: (c: string) => void;
  const p = new Promise<string>(r => resolveCode = r);
  
  const server = Bun.serve({
    port: 19288,
    hostname: "127.0.0.1",
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        if (code) {
          resolveCode(code);
          return new Response("Got code! Close this.");
        }
      }
      return new Response("Not found", { status: 404 });
    }
  });

  const code = await p;
  server.stop();
  console.log(`   Got Authorization Code: ${code.substring(0, 10)}...`);

  // 3. Token Exchange (PURE BEARER - NO DPoP HEADERS)
  console.log("\n3. Exchanging Token (Bearer)...");
  const tokenRes = await fetch(`${AIP_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id,
      code_verifier: codeVerifier,
    }),
  });

  const tokenBody = await tokenRes.json();
  console.log("   Token Response:", JSON.stringify(tokenBody, null, 2));
  
  if (!tokenRes.ok) throw new Error("Token exchange failed");

  const accessToken = tokenBody.access_token;
  
  // 3b. Verify Token against AIP UserInfo (Directly)
  console.log("\n3b. Verifying Token against AIP /oauth/userinfo (Bearer)...");
  const userinfoRes = await fetch(`${AIP_URL}/oauth/userinfo`, {
      headers: {
          Authorization: `Bearer ${accessToken}`
      }
  });
  console.log(`   UserInfo Status: ${userinfoRes.status}`);
  console.log(`   UserInfo Body: ${await userinfoRes.text()}`);

  // 4. Test Admin API (Bearer)
  console.log("\n4. Testing /admin/admins (Bearer)...");
  const adminRes = await fetch(`${HAPPYVIEW_URL}/admin/admins`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  console.log(`   Status: ${adminRes.status}`);
  console.log(`   Headers:`, JSON.stringify(Object.fromEntries(adminRes.headers), null, 2));
  console.log(`   Body: ${await adminRes.text()}`);

  if (adminRes.status === 401) {
    console.log("\n   FAILED. The server rejected the Bearer token.");
  } else {
    console.log("\n   SUCCESS! Plain Bearer auth works.");
  }
}

main().catch(console.error);

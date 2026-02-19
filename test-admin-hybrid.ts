import { createHash } from "crypto";
import { SignJWT, exportJWK, generateKeyPair } from "jose";

const HAPPYVIEW_URL = "https://happyview-production.up.railway.app";
const AIP_URL = "https://aip-production-0438.up.railway.app";
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
  console.log("=== Hybrid Admin API Test (Bearer Token + DPoP Header) ===");

  // 1. Register Client
  const redirectUri = "http://127.0.0.1:19286/callback";
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
      client_name: "HappyView Hybrid Debug",
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
    port: 19286,
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

  // 4. Test Admin API (Hybrid: Bearer Token, but WITH DPoP Proof using ephemeral keys)
  console.log("\n4. Testing /admin/admins (Hybrid DPoP)...");
  
  // Generate ephemeral DPoP keys
  const { privateKey, publicKey } = await generateKeyPair("ES256");
  const publicJwk = await exportJWK(publicKey);
  
  async function genProof(method: string, url: string, nonce?: string) {
      const u = new URL(url);
      const htu = u.origin + u.pathname; // RFC9449 compliant
      
      const claims: any = {
          htm: method,
          htu,
          ath: createHash("sha256").update(accessToken).digest("base64url")
      };
      if (nonce) claims.nonce = nonce;
      
      return new SignJWT(claims)
        .setProtectedHeader({ typ: "dpop+jwt", alg: "ES256", jwk: publicJwk })
        .setIssuedAt()
        .setJti(crypto.randomUUID())
        .sign(privateKey);
  }

  // 4a. Initial Request (to get nonce)
  // Even though we expect failure, we send a valid DPoP first? 
  // Or just GET to get nonce? Let's send DPoP to be polite.
  let targetUrl = `${HAPPYVIEW_URL}/admin/admins`;
  let proof = await genProof("GET", targetUrl);
  
  let adminRes = await fetch(targetUrl, {
    headers: {
      Authorization: `DPoP ${accessToken}`, // Must use DPoP scheme if sending DPoP header
      DPoP: proof
    }
  });

  console.log(`\n   Attempt 1 Status: ${adminRes.status}`);
  if (adminRes.status === 401) {
      const body = await adminRes.text();
      let nonce = adminRes.headers.get("dpop-nonce");
      if (!nonce) try { nonce = JSON.parse(body).dpop_nonce } catch {}
      
      if (nonce) {
          console.log(`   Got nonce: ${nonce}. Retrying...`);
          proof = await genProof("GET", targetUrl, nonce);
          adminRes = await fetch(targetUrl, {
              headers: {
                  Authorization: `DPoP ${accessToken}`,
                  DPoP: proof
              }
          });
          console.log(`   Attempt 2 Status: ${adminRes.status}`);
          console.log(`   Body: ${await adminRes.text()}`);
      } else {
          console.log("   No nonce found in 401.");
      }
  } else {
      console.log(`   Body: ${await adminRes.text()}`);
  }
}

main().catch(console.error);

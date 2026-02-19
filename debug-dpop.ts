import { createHash } from "crypto";
import { SignJWT, importJWK } from "jose";

// Load from .env manually to be sure
const envText = await Bun.file(".env").text();
const env: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const [k, v] = line.split("=");
  if (k && v) env[k.trim()] = v.trim();
}

const TOKEN = env.AIP_TOKEN;
const JWK_STR = env.DPOP_JWK;
const HV_URL = env.HAPPYVIEW_URL;
const AIP_URL = env.AIP_URL;

console.log("Token:", TOKEN ? TOKEN.substring(0, 10) + "..." : "MISSING");
console.log("JWK:", JWK_STR ? "FOUND" : "MISSING");

if (!TOKEN || !JWK_STR) process.exit(1);

const jwk = JSON.parse(JWK_STR);
const privateKey = (await importJWK(
  { ...jwk, kty: "EC", crv: "P-256" },
  "ES256"
)) as CryptoKey;
const publicKey = { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y };

async function genProof(method: string, url: string, nonce?: string) {
  const ath = createHash("sha256").update(TOKEN!).digest("base64url");
  const claims: any = { htm: method, htu: url, ath };
  if (nonce) claims.nonce = nonce;
  
  return new SignJWT(claims)
    .setProtectedHeader({ typ: "dpop+jwt", alg: "ES256", jwk: publicKey })
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .sign(privateKey);
}

async function testRequest() {
  const url = `${HV_URL}/admin/lexicons`;
  console.log(`\nGET ${url}`);
  
  // 1. First try (no nonce)
  let proof = await genProof("GET", url);
  console.log("Proof 1:", proof.substring(0, 20) + "...");
  
  let res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `DPoP ${TOKEN}`,
      DPoP: proof
    }
  });
  
  console.log(`Status 1: ${res.status}`);
  console.log(`Headers 1:`, Object.fromEntries(res.headers));
  const body1 = await res.text();
  console.log(`Body 1: ${body1}`);
  
  if (res.status === 401) {
    let nonce = res.headers.get("dpop-nonce");
    if (!nonce) {
        try {
            const p = JSON.parse(body1);
            nonce = p.dpop_nonce;
        } catch {}
    }
    
    if (nonce) {
        console.log(`\nRetrying with nonce: ${nonce}`);
        // 2. Retry with nonce
        proof = await genProof("GET", url, nonce);
        res = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `DPoP ${TOKEN}`,
                DPoP: proof
            }
        });
        console.log(`Status 2: ${res.status}`);
        console.log(`Body 2: ${await res.text()}`);
    }
  }
}

async function verifyToken() {
    const url = `${AIP_URL}/oauth/userinfo`;
    console.log(`\nChecking Token at: ${url}`);
    
    // First try
    let proof = await genProof("GET", url);
    let res = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `DPoP ${TOKEN}`,
            DPoP: proof
        }
    });
    
    console.log(`UserInfo Status 1: ${res.status}`);
    const body = await res.text();
    console.log(`UserInfo Body 1: ${body}`);
    
    if (res.status === 401) {
       // try finding nonce
       let nonce = res.headers.get("dpop-nonce");
       if (!nonce) try { nonce = JSON.parse(body).dpop_nonce } catch {}
       
       if (nonce) {
           console.log(`Retrying UserInfo with nonce: ${nonce}`);
           proof = await genProof("GET", url, nonce);
           res = await fetch(url, {
               method: "GET",
               headers: {
                   Authorization: `DPoP ${TOKEN}`,
                   DPoP: proof
               }
           });
           console.log(`UserInfo Status 2: ${res.status}`);
           console.log(`UserInfo Body 2: ${await res.text()}`);
       }
    }
}

await verifyToken();
await testRequest();

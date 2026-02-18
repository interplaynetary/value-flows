#!/usr/bin/env bun
// Quickslice OAuth Login
//
// Usage:
//   bun scripts/qs-login.ts [handle-or-did]
//
//   bun scripts/qs-login.ts ruzgarimski.bsky.social
//   bun scripts/qs-login.ts did:plc:jakdfmodsnsb2bmfw2l3cuwd
//
// Opens a browser to authenticate with your Quickslice instance and saves
// QUICKSLICE_TOKEN + QUICKSLICE_DPOP_JWK to .env.
//
// After login, run tests with:
//   bun test ./tests/graphql.ts

import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { createHash } from "crypto";

const QUICKSLICE_URL =
  process.env.QUICKSLICE_URL ??
  "https://quickslice-production-d7e0.up.railway.app";

// Pre-registered public OAuth client (see auth.html)
const CLIENT_ID = "client_seyQKMo1iQE0KZA8QMps0w";
const CALLBACK_PORT = 3000;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

// login_hint: required by Quickslice — DID or handle tells it which PDS to use
const loginHint =
  process.argv[2] ||          // CLI arg takes priority
  process.env.MY_DID ||       // fallback to DID in .env
  "";

if (!loginHint) {
  console.error("Error: provide your handle or DID as the first argument.");
  console.error("  bun scripts/qs-login.ts ruzgarimski.bsky.social");
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateRandomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = createHash("sha256").update(verifier).digest();
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function updateEnvFile(token: string, jwk: object) {
  const envPath = new URL("../.env", import.meta.url).pathname;
  let content: string;
  try {
    content = await Bun.file(envPath).text();
  } catch {
    content = "";
  }

  const jwkStr = JSON.stringify(jwk);

  if (/^QUICKSLICE_TOKEN=/m.test(content)) {
    content = content.replace(/^QUICKSLICE_TOKEN=.*$/m, `QUICKSLICE_TOKEN=${token}`);
  } else {
    content += `\nQUICKSLICE_TOKEN=${token}`;
  }

  if (/^QUICKSLICE_DPOP_JWK=/m.test(content)) {
    content = content.replace(/^QUICKSLICE_DPOP_JWK=.*$/m, `QUICKSLICE_DPOP_JWK=${jwkStr}`);
  } else {
    content += `\nQUICKSLICE_DPOP_JWK=${jwkStr}`;
  }

  await Bun.write(envPath, content);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("Starting Quickslice OAuth login...\n");

// 1. Generate DPoP key pair
const { privateKey: loginPrivKey, publicKey: loginPubKey } =
  await generateKeyPair("ES256", { extractable: true });

const fullJwk = await exportJWK(loginPrivKey);
const pubJwkExported = await exportJWK(loginPubKey);
const loginPublicJwk = {
  kty: "EC" as const,
  crv: "P-256" as const,
  x: pubJwkExported.x!,
  y: pubJwkExported.y!,
};

// 2. Generate PKCE
const codeVerifier = generateRandomString(32);
const codeChallenge = await generateCodeChallenge(codeVerifier);
const state = generateRandomString(16);

// 3. Start local callback server
let resolveCode!: (code: string) => void;
const codePromise = new Promise<string>((resolve) => {
  resolveCode = resolve;
});

const server = Bun.serve({
  port: CALLBACK_PORT,
  hostname: "localhost",
  routes: {
    "/callback": (req) => {
      const url = new URL(req.url);
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");

      if (returnedState !== state) {
        return new Response(
          "<html><body><h2>State mismatch — possible CSRF</h2></body></html>",
          { headers: { "Content-Type": "text/html" } },
        );
      }
      if (!code) {
        return new Response(
          "<html><body><h2>No authorization code received</h2></body></html>",
          { headers: { "Content-Type": "text/html" } },
        );
      }

      resolveCode(code);
      return new Response(
        "<html><body><h2>Login successful!</h2><p>You can close this tab and return to the terminal.</p></body></html>",
        { headers: { "Content-Type": "text/html" } },
      );
    },
  },
  fetch() {
    return new Response("Not found", { status: 404 });
  },
});

// 4. Build authorization URL
const authorizeUrl = new URL(`${QUICKSLICE_URL}/oauth/authorize`);
authorizeUrl.searchParams.set("response_type", "code");
authorizeUrl.searchParams.set("client_id", CLIENT_ID);
authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authorizeUrl.searchParams.set("code_challenge", codeChallenge);
authorizeUrl.searchParams.set("code_challenge_method", "S256");
authorizeUrl.searchParams.set("state", state);
authorizeUrl.searchParams.set("scope", "atproto transition:generic");
authorizeUrl.searchParams.set("login_hint", loginHint);

const authUrl = authorizeUrl.toString();
console.log("Opening browser for authorization...");
console.log(`\nIf the browser doesn't open, visit:\n${authUrl}\n`);

const opener =
  process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "start"
      : "xdg-open";
Bun.spawn([opener, authUrl], { stdout: "ignore", stderr: "ignore" });

console.log("Waiting for authorization callback...");

// 5. Wait for the callback
const code = await codePromise;
console.log("Authorization code received!");

// 6. Exchange code for token (with DPoP proof, handle nonce retry)
const tokenUrl = `${QUICKSLICE_URL}/oauth/token`;

function makeDPoPProof(nonce?: string) {
  const claims: Record<string, string> = { htm: "POST", htu: tokenUrl };
  if (nonce) claims.nonce = nonce;
  return new SignJWT(claims)
    .setProtectedHeader({ typ: "dpop+jwt", alg: "ES256", jwk: loginPublicJwk })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .sign(loginPrivKey);
}

const tokenBody = new URLSearchParams({
  grant_type: "authorization_code",
  code,
  redirect_uri: REDIRECT_URI,
  client_id: CLIENT_ID,
  code_verifier: codeVerifier,
});

let tokenRes = await fetch(tokenUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    DPoP: await makeDPoPProof(),
  },
  body: tokenBody,
});

// Handle DPoP nonce requirement
if (!tokenRes.ok) {
  const body = await tokenRes.text();
  let nonce = tokenRes.headers.get("dpop-nonce");
  if (!nonce) {
    try {
      nonce = JSON.parse(body)?.dpop_nonce ?? null;
    } catch {}
  }

  if (nonce) {
    console.log("Retrying token exchange with DPoP nonce...");
    tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        DPoP: await makeDPoPProof(nonce),
      },
      body: tokenBody,
    });
  } else {
    server.stop();
    console.error(`Token exchange failed (${tokenRes.status}): ${body}`);
    process.exit(1);
  }
}

if (!tokenRes.ok) {
  const text = await tokenRes.text();
  server.stop();
  console.error(`Token exchange failed (${tokenRes.status}): ${text}`);
  process.exit(1);
}

const tokenData = (await tokenRes.json()) as {
  access_token: string;
  sub?: string;
  expires_in?: number;
};

server.stop();

// 7. Save credentials to .env
await updateEnvFile(tokenData.access_token, {
  crv: "P-256",
  d: fullJwk.d,
  kty: "EC",
  x: fullJwk.x,
  y: fullJwk.y,
});

console.log("\nLogin successful!");
if (tokenData.sub) console.log(`DID: ${tokenData.sub}`);
if (tokenData.expires_in)
  console.log(`Token expires in: ${Math.round(tokenData.expires_in / 60)} minutes`);
console.log("Credentials saved to .env (QUICKSLICE_TOKEN + QUICKSLICE_DPOP_JWK)");
console.log("\nNow run the tests:");
console.log("  bun test ./tests/graphql.ts");

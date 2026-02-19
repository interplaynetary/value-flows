// src/lib/aip.svelte.ts
//
// AIP OAuth 2.0 login flow — PKCE + DPoP, matching the happyview.ts CLI flow.
// Works with any AIP-compatible server (VITE_AIP_URL).

import { importJWK, SignJWT } from 'jose';
import { auth } from '$lib/auth.svelte';

const AIP_URL = import.meta.env.VITE_AIP_URL as string;

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function randomString(len = 32): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ── DPoP proof ────────────────────────────────────────────────────────────────

async function dpopProof(privateJwk: JsonWebKey, publicJwk: JsonWebKey, method: string, url: string): Promise<string> {
  const privateKey = await importJWK(privateJwk, 'ES256');
  return new SignJWT({ htm: method, htu: url, jti: randomString(16) })
    .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk: publicJwk })
    .setIssuedAt()
    .sign(privateKey);
}

// ── session keys (sessionStorage) ────────────────────────────────────────────

const SK = {
  verifier: 'aip_verifier',
  state: 'aip_state',
  clientId: 'aip_client_id',
  redirectUri: 'aip_redirect_uri',
  privateJwk: 'aip_dpop_private',
  publicJwk: 'aip_dpop_public',
} as const;

function clearOAuthSession() {
  Object.values(SK).forEach((k) => sessionStorage.removeItem(k));
}

// ── AIP state ─────────────────────────────────────────────────────────────────

class Aip {
  loading = $state(false);
  error = $state<string | null>(null);

  /** Step 1: register client, build authorize URL, redirect. */
  async login(handle: string) {
    this.loading = true;
    this.error = null;
    try {
      // Generate DPoP key pair
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
      );
      const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
      const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

      // PKCE
      const verifier = randomString(32);
      const challenge = await codeChallenge(verifier);
      const state = randomString(16);

      // Register a public OAuth client
      const redirectUri = `${window.location.origin}/login/callback`;
      const regRes = await fetch(`${AIP_URL}/oauth/clients/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redirect_uris: [redirectUri],
          grant_types: ['authorization_code'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none',
          application_type: 'web',
          client_name: 'Open Association',
        }),
      });
      if (!regRes.ok) throw new Error(`Client registration failed (${regRes.status})`);
      const { client_id } = (await regRes.json()) as { client_id: string };

      // Persist OAuth session for the callback
      sessionStorage.setItem(SK.verifier, verifier);
      sessionStorage.setItem(SK.state, state);
      sessionStorage.setItem(SK.clientId, client_id);
      sessionStorage.setItem(SK.redirectUri, redirectUri);
      sessionStorage.setItem(SK.privateJwk, JSON.stringify(privateJwk));
      sessionStorage.setItem(SK.publicJwk, JSON.stringify(publicJwk));

      // Redirect to AIP
      const url = new URL(`${AIP_URL}/oauth/authorize`);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', client_id);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('state', state);
      url.searchParams.set('scope', 'atproto');
      url.searchParams.set('login_hint', handle);
      window.location.href = url.toString();
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'Login failed';
      this.loading = false;
    }
  }

  /** Step 2: handle redirect back from AIP, exchange code for token. */
  async handleCallback(code: string, returnedState: string): Promise<boolean> {
    this.loading = true;
    this.error = null;
    try {
      if (returnedState !== sessionStorage.getItem(SK.state)) {
        throw new Error('State mismatch — possible CSRF');
      }

      const verifier = sessionStorage.getItem(SK.verifier)!;
      const clientId = sessionStorage.getItem(SK.clientId)!;
      const redirectUri = sessionStorage.getItem(SK.redirectUri)!;
      const privateJwk = JSON.parse(sessionStorage.getItem(SK.privateJwk)!) as JsonWebKey;
      const publicJwk = JSON.parse(sessionStorage.getItem(SK.publicJwk)!) as JsonWebKey;

      const tokenEndpoint = `${AIP_URL}/oauth/token`;
      const proof = await dpopProof(privateJwk, publicJwk, 'POST', tokenEndpoint);

      const tokenRes = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          DPoP: proof,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          code_verifier: verifier,
        }),
      });
      if (!tokenRes.ok) throw new Error(`Token exchange failed (${tokenRes.status})`);

      const { access_token, sub } = (await tokenRes.json()) as {
        access_token: string;
        sub?: string;
      };

      // sub is the DID; fall back to userinfo if not in token response
      let did = sub;
      if (!did) {
        const infoProof = await dpopProof(privateJwk, publicJwk, 'GET', `${AIP_URL}/oauth/userinfo`);
        const infoRes = await fetch(`${AIP_URL}/oauth/userinfo`, {
          headers: { Authorization: `DPoP ${access_token}`, DPoP: infoProof },
        });
        did = ((await infoRes.json()) as { sub: string }).sub;
      }

      auth.setSession(access_token, did!);
      clearOAuthSession();
      return true;
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'Login failed';
      return false;
    } finally {
      this.loading = false;
    }
  }
}

export const aip = new Aip();

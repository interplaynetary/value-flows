// src/lib/auth.svelte.ts
//
// SSR note: Module-level $state must live in class fields, not object literals.
// Gate all sessionStorage access behind `if (browser)` (from $app/environment)
// or call loadFromStorage() only from a client-side layout.

class Auth {
  token = $state<string | null>(null);
  did = $state<string | null>(null);

  get isLoggedIn() {
    return this.token !== null;
  }

  setSession(token: string, did: string) {
    this.token = token;
    this.did = did;
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('did', did);
  }

  loadFromStorage() {
    this.token = sessionStorage.getItem('token');
    this.did = sessionStorage.getItem('did');
  }

  logout() {
    this.token = null;
    this.did = null;
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('did');
  }
}

export const auth = new Auth();

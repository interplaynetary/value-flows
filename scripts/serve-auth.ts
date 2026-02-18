#!/usr/bin/env bun
// Dev server for auth.html browser tests
// Usage: bun scripts/serve-auth.ts

Bun.serve({
  port: 3000,
  routes: {
    // Redirect root to /callback so the SDK's default redirect_uri matches
    "/": () => Response.redirect("http://localhost:3000/callback", 302),

    // Serve the SDK ESM bundle so auth.html can import it
    "/quickslice-client.esm.js": () =>
      new Response(
        Bun.file("node_modules/quickslice-client-js/dist/quickslice-client.esm.js"),
        { headers: { "Content-Type": "application/javascript" } },
      ),

    // Primary app URL — also the OAuth callback so the SDK's default redirect_uri matches
    "/callback": () =>
      new Response(Bun.file("statusSphere.html"), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
  },

  fetch(req) {
    return new Response("Not found", { status: 404 });
  },
});

console.log("Dev server: http://localhost:3000");
console.log("Open that URL in your browser to test CRUD.");

const port = 19287;

const server = Bun.serve({
  port,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    console.log(`[Server] ${req.method} ${path}`);

    // Serve the HTML file for root and callback
    if (path === "/" || path === "/callback" || path === "/browser-auth.html") {
      return new Response(Bun.file("public/browser-auth.html"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Browser Auth Debugger running at http://127.0.0.1:${port}`);
console.log(`Callback URL: http://127.0.0.1:${port}/callback`);
console.log(`Open http://127.0.0.1:${port} in your browser.`);

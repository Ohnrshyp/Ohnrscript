Bun.serve({
  port: 8080,
  fetch(req) {
    if (new URL(req.url).pathname === "/") {
      return new Response("Hello, World!", {
        headers: {
          "Content-Length": "13",
          "Connection": "keep-alive"
        }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
});
console.log("Listening on :8080");

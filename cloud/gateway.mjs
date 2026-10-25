// Single front door for the Cloud Run container: /api/* goes to the Python app, everything else
// to the React server. Both listen on this container's loopback only.
import http from "node:http";

const PORT = Number(process.env.PORT || 8080);
const API = { host: "127.0.0.1", port: 8000 };
const WEB = { host: "127.0.0.1", port: 3000 };

http
  .createServer((req, res) => {
    const target = req.url.startsWith("/api/") ? API : WEB;
    const upstream = http.request(
      { ...target, method: req.method, path: req.url, headers: req.headers },
      (reply) => {
        res.writeHead(reply.statusCode, reply.headers);
        reply.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
      res.end("The app is still starting. Reload in a few seconds.");
    });
    req.pipe(upstream);
  })
  .listen(PORT, "0.0.0.0");

import * as http from "node:http";
import * as crypto from "node:crypto";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server.js";
import { logger } from "./utils/logger.js";

export interface HttpServerOptions {
  port?: number;
  host?: string;
}

async function readAndNormalizeBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw || raw.trim().length === 0) {
        resolve(undefined);
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        // Normalize OpenCode clientInfo if version is omitted
        if (
          parsed &&
          typeof parsed === "object" &&
          parsed.method === "initialize" &&
          parsed.params?.clientInfo &&
          !parsed.params.clientInfo.version
        ) {
          parsed.params.clientInfo.version = "1.0.0";
          logger.debug("Normalized missing clientInfo.version for OpenCode initialization.");
        }
        resolve(parsed);
      } catch {
        resolve(undefined);
      }
    });
    req.on("error", () => resolve(undefined));
  });
}

export function startHttpServer(options: HttpServerOptions = {}): Promise<{
  server: http.Server;
  port: number;
  host: string;
}> {
  const envPort = process.env.PORT || process.env.JEV_PORT;
  const port = options.port ?? (envPort ? parseInt(envPort, 10) : 3333);
  const host = options.host ?? process.env.HOST ?? "0.0.0.0";

  // Active SSE transports
  const sseTransports = new Map<string, SSEServerTransport>();

  // Active Streamable HTTP transports (keyed by session ID)
  const streamableTransports = new Map<string, StreamableHTTPServerTransport>();

  const server = http.createServer(async (req, res) => {
    // Add CORS headers for desktop agents and web clients
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Mcp-Session-Id, Last-Event-Id, X-Requested-With, Accept"
    );
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Mcp-Session-Id, Content-Type"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }

    const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = parsedUrl.pathname;

    logger.debug(`HTTP ${req.method} ${pathname}${parsedUrl.search}`);

    // 1. Healthcheck endpoint
    if (pathname === "/health" || (pathname === "/" && req.method === "GET")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          name: "jev-router",
          version: "0.1.0",
          endpoints: {
            sse: "/sse",
            messages: "/messages",
            mcp: "/mcp",
          },
        })
      );
      return;
    }

    // 2. SSE Connection endpoint (GET /sse)
    if (pathname === "/sse" && req.method === "GET") {
      logger.info("New SSE client connection initiating at /sse");
      try {
        const transport = new SSEServerTransport("/sse", res);
        const mcpServer = createMcpServer();

        sseTransports.set(transport.sessionId, transport);
        logger.info(`Registered SSE transport with sessionId: ${transport.sessionId}`);

        transport.onclose = () => {
          logger.info(`SSE client disconnected: ${transport.sessionId}`);
          sseTransports.delete(transport.sessionId);
        };

        await mcpServer.connect(transport);
        return;
      } catch (err) {
        logger.error(`Error establishing SSE connection: ${String(err)}`);
        if (!res.headersSent) {
          res.writeHead(500).end("Internal Server Error");
        }
        return;
      }
    }

    // 3. POST messages (handles /sse, /messages, /mcp, /)
    if (req.method === "POST") {
      const parsedBody = await readAndNormalizeBody(req);

      const sessionId =
        parsedUrl.searchParams.get("sessionId") ||
        (req.headers["mcp-session-id"] as string | undefined) ||
        (req.headers["Mcp-Session-Id"] as string | undefined);

      // A. Check if this is an active SSE session post
      let sseTransport = sessionId ? sseTransports.get(sessionId) : undefined;
      if (!sseTransport && pathname === "/sse" && sseTransports.size > 0) {
        sseTransport = Array.from(sseTransports.values()).pop();
      }

      if (sseTransport) {
        try {
          await sseTransport.handlePostMessage(req, res, parsedBody);
          return;
        } catch (err) {
          logger.error(`Error in SSE handlePostMessage: ${String(err)}`);
          if (!res.headersSent) {
            res.writeHead(500).end("Internal Server Error");
          }
          return;
        }
      }

      // Ensure Accept header satisfies Streamable HTTP requirement
      if (!req.headers.accept || !req.headers.accept.includes("text/event-stream")) {
        req.headers.accept = req.headers.accept
          ? `${req.headers.accept}, text/event-stream`
          : "application/json, text/event-stream";
      }

      // B. Handle via Streamable HTTP (OpenCode default)
      let streamableTransport = sessionId ? streamableTransports.get(sessionId) : undefined;

      if (!streamableTransport) {
        streamableTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });
        const mcpServer = createMcpServer();
        await mcpServer.connect(streamableTransport);

        if (streamableTransport.sessionId) {
          streamableTransports.set(streamableTransport.sessionId, streamableTransport);
        }

        streamableTransport.onclose = () => {
          if (streamableTransport?.sessionId) {
            streamableTransports.delete(streamableTransport.sessionId);
          }
        };
      }

      try {
        await streamableTransport.handleRequest(req, res, parsedBody);

        // Store transport if session ID was generated during handleRequest
        if (streamableTransport.sessionId && !streamableTransports.has(streamableTransport.sessionId)) {
          streamableTransports.set(streamableTransport.sessionId, streamableTransport);
        }
        return;
      } catch (err) {
        logger.error(`Error in Streamable HTTP handleRequest: ${String(err)}`);
        if (!res.headersSent) {
          res.writeHead(500).end("Internal Server Error");
        }
        return;
      }
    }

    // 4. Streamable GET stream endpoint (/mcp)
    if (pathname === "/mcp" && req.method === "GET") {
      const sessionId =
        parsedUrl.searchParams.get("sessionId") ||
        (req.headers["mcp-session-id"] as string | undefined);

      const streamableTransport = sessionId ? streamableTransports.get(sessionId) : undefined;
      if (streamableTransport) {
        await streamableTransport.handleRequest(req, res);
        return;
      }
    }

    // Not found fallback
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found", path: pathname }));
  });

  return new Promise((resolve, reject) => {
    server.on("error", (err) => {
      logger.error(`HTTP server failed to bind: ${String(err)}`);
      reject(err);
    });

    server.listen(port, host, () => {
      const actualPort = (server.address() as any).port;
      logger.info(`=======================================================`);
      logger.info(`jev-router MCP server running in HTTP/SSE mode!`);
      logger.info(`Listening on: http://${host}:${actualPort}`);
      logger.info(`SSE endpoint: http://${host}:${actualPort}/sse`);
      logger.info(`Streamable MCP: http://${host}:${actualPort}/mcp`);
      logger.info(`Health check: http://${host}:${actualPort}/health`);
      logger.info(`=======================================================`);
      resolve({ server, port: actualPort, host });
    });
  });
}

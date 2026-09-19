import { describe, it, expect, afterAll } from "vitest";
import { startHttpServer } from "../src/http.js";
import * as http from "node:http";

describe("HTTP / SSE Transport Server", () => {
  let serverInstance: http.Server | null = null;
  let port: number = 0;

  afterAll(() => {
    if (serverInstance) {
      serverInstance.close();
    }
  });

  it("should bind to an ephemeral port and serve health check", async () => {
    const { server, port: boundPort } = await startHttpServer({ port: 0 });
    serverInstance = server;
    port = boundPort;
    expect(port).toBeGreaterThan(0);

    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.name).toBe("jev-router");
    expect(data.endpoints.sse).toBe("/sse");
  });

  it("should return SSE stream headers on GET /sse", async () => {
    const controller = new AbortController();
    const responsePromise = fetch(`http://localhost:${port}/sse`, {
      signal: controller.signal,
    });

    const res = await responsePromise;
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    // Test POSTing to /sse with sessionId or fallback
    const postRes = await fetch(`http://localhost:${port}/sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "opencode", version: "1.0.0" },
        },
      }),
    });

    expect(postRes.status).toBe(202);
    controller.abort();
  });
});

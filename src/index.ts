import "./utils/env.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";
import { startHttpServer } from "./http.js";
import { jevEngine } from "./jev/client.js";
import { logger } from "./utils/logger.js";

async function main() {
  const args = process.argv.slice(2);
  const isHttpArg = args.includes("--http");
  const portArgIndex = args.indexOf("--port");
  const portArg = portArgIndex !== -1 ? parseInt(args[portArgIndex + 1], 10) : undefined;

  const hasPortEnv = Boolean(process.env.PORT || process.env.JEV_PORT);
  const isHttpMode = isHttpArg || portArg !== undefined || hasPortEnv;

  logger.info(`Engine Mode: ${jevEngine.isMockMode() ? "Mock Simulation" : "Live TypeSafe API"}`);

  if (isHttpMode) {
    // 1. Run in HTTP/SSE mode (Accessible via URL by OpenCode, Claude Desktop, Cursor)
    const { server, port, host } = await startHttpServer({ port: portArg });

    const shutdown = async () => {
      logger.info("Shutting down jev-router HTTP server...");
      server.close(() => {
        logger.info("HTTP server closed.");
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } else {
    // 2. Run in Stdio mode (Default for local agent spawned subprocesses)
    logger.info("Starting jev-router in Stdio transport mode...");
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("jev-router MCP server connected to stdio transport.");

    const shutdown = async () => {
      logger.info("Shutting down jev-router MCP server...");
      await server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
}

main().catch((err) => {
  logger.error(`Fatal server error: ${String(err)}`);
  process.exit(1);
});

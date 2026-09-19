# jev-router

> Read this first: an AI agent wrote the code here. I picked what to build and how it should behave. I did not read most of the implementation. I use this for my own work, so it reflects my preferences.

jev-router is a small MCP server. You place it in front of a coding agent. Your agent checks in before it edits files and checks back after it has a diff.

It exposes four tools:

- `assess_task` rates task complexity, sets a reasoning budget, points at entry files, and matches installed skills.
- `evaluate_plan` reviews a plan for clarity, scope, risks, and verification steps before you allow edits.
- `evaluate_code` runs lint and type checks, then scores the diff for safety, security, and intent match. It tracks retries and hands control back to you after 5 failed attempts.
- `list_skills` scans `.opencode/skills/`, `.agents/skills/`, and global skill folders and returns what it finds.

You need a `TYPESAFE_API_KEY` for the semantic checks. Deterministic checks run without it.

## Run

```bash
pnpm install
pnpm test
pnpm run build
```

Two modes:

```bash
# stdio, default
node dist/index.js

# HTTP/SSE on port 3333
pnpm run serve
PORT=8080 pnpm run serve
```

HTTP mode exposes:

- `http://localhost:3333/sse` for SSE
- `http://localhost:3333/mcp` for streamable MCP
- `http://localhost:3333/health` for health checks

## Connect

Remote over SSE (`opencode.json`):

```json
{
  "mcp": {
    "jev-router": {
      "type": "remote",
      "url": "http://localhost:3333/sse",
      "enabled": true
    }
  }
}
```

Local over stdio:

```json
{
  "mcp": {
    "jev-router": {
      "type": "local",
      "command": ["node", "/absolute/path/to/jev-router/dist/index.js"],
      "enabled": true,
      "env": {
        "TYPESAFE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "jev-router": {
      "command": "node",
      "args": ["/absolute/path/to/jev-router/dist/index.js"],
      "env": {
        "TYPESAFE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Agent workflow

The skill file lives at `.opencode/skills/jev-router/SKILL.md`.

Your agent follows three steps:

1. Call `assess_task` before it touches files.
2. If the answer says `requires_plan: true`, it sends the plan to `evaluate_plan` and waits for approval.
3. It sends each diff to `evaluate_code` and fixes what comes back until approval or escalation.

## Inspect

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Docker

HTTP mode in a container (port 3333, `/health`, `/sse`, `/mcp`):

```bash
cp .env.example .env   # set TYPESAFE_API_KEY
docker compose up --build -d
curl http://localhost:3333/health
docker compose logs -f jev-router
```

Plain Docker:

```bash
docker build -t jev-router .
docker run -d --name jev-router -p 3333:3333 --env-file .env jev-router
```

Stdio mode via Docker (for a local MCP client that spawns the server).
Note: the image sets `PORT=3333` so it defaults to HTTP; clear it to force stdio:

```bash
docker run -i --rm --env-file .env -e PORT= -e JEV_PORT= --entrypoint node jev-router dist/index.js
```

Connect OpenCode to the container (`opencode.json`): point the remote URL at the mapped port (default `http://localhost:3333/sse`).

### Workspace / skills mounts

`list_skills` scans `working_directory` (`.opencode/skills/`, `.agents/skills/`, `.claude/skills/`) plus global skill dirs. The container only sees what you mount — without mounts it returns `{"count":0,"skills":[]}` because host paths don't exist inside the container.

`docker-compose.yml` already mounts `${HOST_WORKSPACE:-./}` at `/workspace` (read-only), mirrors `${HOST_HOME:-${HOME}}` at the identical host path (read-only) so host absolute paths also resolve, and mounts your host global skills into `/home/appuser/.config/opencode/skills`. Then call tools with the **container** path:

```bash
HOST_WORKSPACE=$PWD docker compose up --build -d
```

`list_skills` with `{"working_directory": "/workspace"}`.

If you pass a host absolute `working_directory` that isn't mounted, the server logs a warning and falls back to `/workspace` automatically (`src/utils/workspace.ts:11`). For checkouts outside `$HOME`, set `HOST_HOME` to that parent:

```bash
HOST_HOME=$HOME/Projects docker compose up --build -d
```

```bash
docker run -d --name jev-router -p 3333:3333 --env-file .env \
  -v $PWD:/workspace:ro \
  -v $HOME:$HOME:ro \
  -v ~/.config/opencode/skills:/home/appuser/.config/opencode/skills:ro \
  jev-router
```

Note: `evaluate_code` pre-checks execute inside the container (`exec` in `working_directory`), so the mount must contain the project with its toolchain/deps, or set `deterministic_checks.custom_command` / disable pre-checks in `jev-router.config.json`.

## Status

I have not audited this code. Review it yourself before you trust it on anything important.

## License

MIT

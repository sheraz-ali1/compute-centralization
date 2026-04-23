# ComputeGrid

Open price feed for the GPU spot market. For agents and the humans they work for.

A real-time, agent-native aggregator of GPU prices and availability across compute providers (RunPod, Vast.ai, Vultr, with Lambda and Fluidstack planned). Surfaces the long tail of community/spot capacity that is invisible to enterprise buyers.

Three parallel surfaces over one source of truth:

- **Web terminal** at `/` — Bloomberg-style live market view
- **MCP server** at `/mcp` — for agents (Claude, Cursor, custom)
- **Open JSON** at `/api/snapshot.json`, `/api/stream` — for anyone

## Status

Pre-implementation. Design doc at [`docs/plans/2026-04-22-computegrid-design.md`](docs/plans/2026-04-22-computegrid-design.md).

## License

TBD — intended to be open and free to use.

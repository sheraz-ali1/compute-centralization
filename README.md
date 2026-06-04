# ComputeGrid

Open price feed for the GPU spot market. For agents and the humans they work for.

A real-time, agent-native aggregator of GPU prices and availability across compute providers (RunPod, Vast.ai, Vultr, with Lambda and Fluidstack planned). Surfaces the long tail of community/spot capacity that is invisible to enterprise buyers.

Three parallel surfaces over one source of truth:

- **Web terminal** at `/` — Bloomberg-style live market view
- **MCP server** at `/mcp` — for agents (Claude, Cursor, custom)
- **Open JSON** at `/api/snapshot.json`, `/api/stream` — for anyone

## Status

Live at [compute-grid.com](https://compute-grid.com), refreshing real prices every two minutes.

## Project Submission

**Problem & Insight.** Booking GPUs today means manually checking a dozen provider dashboards, and the cheapest community and spot capacity is effectively invisible to anyone without insider tooling. ComputeGrid collapses that fragmented market into a single live price feed. The bet underneath it is that the next big consumer of GPU pricing won't be a human at all, but agents.

**Execution & Technical Work.** I built and shipped a running product: a single Next.js service that scrapes RunPod, Vast.ai, Vultr, and a 30+ provider aggregator every two minutes, normalizes them into one Postgres-backed schema, and serves it through three surfaces. It's genuinely functional end to end; the live MCP endpoint answers queries like "cheapest H100" with current pricing, and the whole thing runs as one process with an in-memory cache, snapshot diffing, and real-time SSE broadcast.

**Evaluation & Evidence.** Correctness is backed by 21 unit tests across the scrapers and core libraries, price normalization, GPU-model canonicalization, and snapshot diffing. each validated against captured real-API fixtures. Every scraper is failure-isolated, so when a provider goes down (Vultr times out regularly) the feed degrades to stale rows instead of breaking, and a live `/api/health` endpoint reports DB status, row counts, and snapshot freshness as ongoing proof it works.

**Communication & Presentation.** The web terminal is deliberately a single screen that lands the value proposition without scrolling, and the repo ships a full design doc, an implementation plan, and an `/llms.txt` so both people and agents can get oriented fast. Anyone can try it immediately and hook up their favorite agent. open [compute-grid.com](https://compute-grid.com) or point an MCP client at `/mcp` with one command.

**Process, Integrity & Disclosure.** This was built with AI assistance. I used Claude Code as a pair programmer throughout for scaffolding, the scrapers, and debugging. I also had AI help me curate the README file. I made sure to review everything. 

## License

TBD — intended to be open and free to use.

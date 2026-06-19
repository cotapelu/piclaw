# ADR 0002: Team Collaboration Architecture

Date: 2026-06-15
Status: Accepted

## Context

PiClaw needed to support multi-agent collaboration where multiple LLM agents work together on a set of tasks, sharing a workspace and communicating via messages. Requirements:

- Task distribution (load balancing, work stealing)
- Fault tolerance (agent failures, zombie detection)
- Shared in-memory workspace (key-value store)
- Isolation between agents (separate sessions)
- Metrics collection for observability

## Decision

We implemented a `AgentTeam` class that:

- Maintains a list of tasks and their statuses (`pending`, `in_progress`, `completed`, `failed`).
- Tracks agent roles via `registerRuntime()` and maps session IDs to roles.
- Uses a `SharedWorkspace` (simple Map) for data exchange.
- Provides `claimTask()`, `releaseTask()`, `completeTask()`, and `handleAgentFailure()` methods, all guarded by a lock (`withLock`) to ensure thread-safety within the Node.js event loop.
- Detects zombie agents via `updateHeartbeat()` and `reclaimZombieAgents()` based on a timeout (default 2 minutes).
- Emits updates via `notifyUpdate(update)` for UI widgets.
- Collects metrics (task durations, agent task counts, message counts) accessible via `getMetrics()`.
- Auto-disposes after inactivity (5 minutes) via `TeamRegistry`.

Agents are child runtimes created via `createAgentSessionRuntime` and run autonomous loops (`runAgentLoop`). The `team_ops` tool exposes team operations to agents.

## Consequences

- **Positive**: Robust multi-agent collaboration with automatic recovery; metrics for monitoring; team lifecycle management.
- **Negative**: The lock-based concurrency could become a bottleneck under very high contention; the current design relies on cooperative locking within a single event loop, which is sufficient for typical loads (< 100 agents).
- **Risks**: Memory leaks if teams are not disposed properly; mitigated by auto-dispose timer and explicit `dispose()` in shutdown.
- **Mitigations**: Performance threshold verified (10 agents × 50 ops ≈ 27ms). Further scaling would require lock-free data structures or sharding.

## Alternatives Considered

- Worker threads for true parallelism: Rejected due to complexity and overhead; agents are I/O-bound.
- External message broker: Overkill for in-memory collaboration.

## References

- Main implementation: `src/extensions/team/team-manager.ts`
- Team ops tool: `src/extensions/team/team-tool.ts`
- Widget: `src/extensions/team/team-widget.ts`
- Tests: `src/extensions/team/__tests__/`

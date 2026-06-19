# ADR 0003: TUI Widget Rendering Optimization

Date: 2026-06-19
Status: Accepted

## Context

The TUI widgets `team` and `metrics` were polling periodically (every 2s and 5s respectively) and unconditionally calling `ui.setWidget()` on every refresh, regardless of whether the content had changed. This caused unnecessary re-renders, wasting CPU cycles and potentially impacting UI responsiveness, especially when multiple widgets or large content were present.

Additionally, the `team-widget` needed to display frequently changing team status (task progress, agent activity) with low latency.

## Decision

We implemented two complementary optimizations:

1. **Memoization** — Both widgets now cache the last rendered `lines` array. Before calling `ui.setWidget()`, they compare the new lines with the cached version using `arraysEqual`. Only if content changed does the TUI perform a diff and update the screen. This eliminates redundant renders when status is stable.
2. **Event-driven updates for team-widget** — Instead of polling the `TeamRegistry` on a fixed interval, the `team-widget` now subscribes to each `AgentTeam`’s `onUpdate` callback (via `setOnUpdate`). Updates are scheduled (debounced) and trigger a re-render immediately. A short discovery interval (5s) detects new teams created after the widget started. This reduces polling overhead to near-zero and improves update latency from up to 2s to near instantaneous.

Additionally, we added a `widget-performance` tracker (`src/extensions/utils/widget-performance.ts`) to monitor render counts, cache hit rates, and average render times. The `metrics-widget` now displays these statistics.

## Consequences

- **Positive**: Significant reduction in unnecessary re-renders; lower CPU usage; improved perceived responsiveness; measurable cache hit rates (typically 50-70% for team widget). The system remains stable under typical loads.
- **Negative**: Slightly increased state management complexity (caching, attached team IDs, debounce flag). The discovery interval still polls occasionally, but frequency is low (5s).
- **Risks**: Memory leaks if `setOnUpdate` handlers are not cleared on widget shutdown. Mitigated by `stopWidget` explicitly calling `setOnUpdate(undefined)` for attached teams and clearing references.
- **Mitigations**: All tests pass; performance is measured and displayed; code is straightforward.

## Alternatives Considered

- Reactive streams (RxJS) for update propagation: Rejected due to added dependency and learning curve.
- Global event bus: The existing `notifyUpdate` per team is sufficient; we directly attach to each team.

## References

- Team widget (event-driven): `src/extensions/team/team-widget.ts`
- Metrics widget (memoization): `src/extensions/metrics/metrics-widget.ts`
- Performance tracking: `src/extensions/utils/widget-performance.ts`
- Tests: `src/tests/team-widget*.test.ts`, `src/tests/metrics-widget.test.ts`

# ADR 0005: Property-Based Testing for Core Algorithms

Date: 2026-06-19
Status: Accepted

## Context

Unit tests with handcrafted examples can miss edge cases, especially in stateful systems with many possible operation sequences. The team manager (`AgentTeam`) is a core component that manages task distribution, agent heartbeats, and zombie recovery. Its correctness under arbitrary sequences of claims, completions, failures, and releases is critical.

## Decision

We adopted property-based testing using the `fast-check` library to generate random sequences of operations and validate invariants. The first suite, `src/tests/team-manager-property.test.ts`, contains 5 tests that check:

1. `pendingIndices` remains sorted and unique after arbitrary operations.
2. Task assignment exclusivity: no two agents can claim the same task.
3. Total tasks count consistency with initialized tasks.
4. Completed + failed + pending always equals total tasks after any mixed operations.
5. Zombie reclamation resets in-progress tasks to pending (or failed after max retries).

These tests run alongside the existing unit tests and provide confidence in the robustness of the team manager under unpredictable workloads.

## Consequences

- **Positive**: Increased coverage of corner cases; discovered no regressions; the team manager is now validated against a broad range of scenarios.
- **Negative**: Property tests can be harder to debug when they fail (need to reproduce minimal case). The random nature may hide rare bugs; however, repeated runs mitigate this.
- **Risks**: False sense of security if property definitions are incomplete. We must carefully design properties that capture essential invariants.
- **Mitigations**: Keep properties simple and focused; supplement with unit tests for specific scenarios.

## Alternatives Considered

- Model checking (e.g., TLA+): Powerful but heavier and requires separate toolchain.
- Stress testing via fixed loops: Less systematic; properties better express invariants.

## References

- Property test suite: `src/tests/team-manager-property.test.ts`
- fast-check: `node_modules/fast-check/`
- Core algorithm: `src/extensions/team/team-manager.ts`

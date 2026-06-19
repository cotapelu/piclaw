# ADR 0006: Decouple Team Workspace from Global Singleton

Date: 2026-06-19
Status: Proposed

## Context

The current team implementation relies on a global singleton `TeamRegistry` with static access via `TeamRegistry.getInstance()`. This design couples all team operations to a process-wide shared state, leading to several issues:

- **Test brittleness**: Tests must spy on or mock the static `getInstance` to inject behavior, which is cumbersome and error-prone.
- **Multi-session interference**: If multiple agent sessions run concurrently (e.g., multiple TUI instances or programmatic use), they share the same team registry, causing cross-session contamination of teams and metrics.
- **Hidden dependencies**: Consumers (team-tool, team-widget, `AgentTeam` constructors) directly depend on the concrete singleton, making unit testing and modularity difficult.
- **Scalability limits**: A single global registry does not scale to distributed or multi-process scenarios.

We aim to refactor the team subsystem to use dependency injection and per-session isolation while preserving the current functional behavior during the transition.

## Decision

We will introduce a `TeamManager` abstraction and migrate consumers to depend on it via the `ExtensionContext` (or `ExtensionAPI`). The decision involves several incremental steps:

1. **Define `TeamManager` interface** in `src/extensions/team/team-manager.ts` (or a separate file) that captures all operations needed by consumers:
   ```ts
   export interface TeamManager {
     get(teamId: string): AgentTeam | undefined;
     getAll(): Map<string, AgentTeam>;
     has(teamId: string): boolean;
     getTeamStatus(teamId: string): Promise<TeamStatus>;
     waitForTeam(teamId: string, timeoutMs?: number): Promise<boolean>;
     bootTeam(parentRuntime: AgentSessionRuntime, options: BootOptions): Promise<AgentTeam>;
     executeTasks(team: AgentTeam, tasks: string[], onUpdate?: (update: any) => void, options?: { wait?: boolean }): Promise<void>;
     register(teamId: string, team: AgentTeam): void;
     unregister(teamId: string): void;
   }
   ```

2. **Implement `DefaultTeamManager`** that wraps the current `TeamRegistry` singleton. This preserves existing behavior and acts as a bridge during migration.
   ```ts
   class DefaultTeamManager implements TeamManager {
     private registry = TeamRegistry.getInstance();
     // delegate all methods to registry
   }
   ```

3. **Modify `AgentTeam`** to accept a `TeamManager` in its constructor (optional, defaulting to global singleton for backward compatibility). It should use `this.manager` instead of `TeamRegistry.getInstance()` for registration and auto‑dispose interactions.
   ```ts
   constructor(manager?: TeamManager) {
     this.manager = manager ?? DefaultTeamManager.fromSingleton();
     // ... existing init
   }
   ```

4. **Change consumers** to obtain a `TeamManager` from the session context rather than calling the singleton directly.
   - `team-tool.ts`: Use `ctx.teamManager` (injected during session start). If not available, fallback to `DefaultTeamManager` singleton.
   - `team-widget.ts`: Similarly obtain manager from context via a helper.
   - `team-ops-tool.ts`: Use context.
   - Any other extension that references `TeamRegistry`.

5. **Session initialization**: In the factory or session setup code (`src/extensions/factory.ts` or cli), create a single `DefaultTeamManager` instance and attach it to the `ExtensionContext` (e.g., `ctx.teamManager = new DefaultTeamManager()`). This makes it available to all extensions within that session.

6. **Testing support**: Tests can now create a mock/fake `TeamManager` and pass it via context or directly to constructors, eliminating the need to spy on static methods. Existing tests can be migrated gradually.

7. **Deprecation**: Mark `TeamRegistry.getInstance` as internal (keep it for `DefaultTeamManager` delegation) and eventually remove its public use outside the manager implementation.

## Consequences

### Positive

- **Testability**: Tests can inject mock managers easily, improving isolation and reliability.
- **Session isolation**: Each session gets its own manager instance; teams from different sessions do not interfere.
- **Clear dependencies**: All dependencies on team infrastructure are explicit (through the interface).
- **Future extensibility**: Alternative manager implementations (e.g., distributed, persistent) can be introduced without changing consumers.

### Negative

- **Migration effort**: Requires updating all consumers and possibly many tests. Can be done incrementally but takes time.
- **Slight indirection overhead**: Negligible in practice.
- **Breaking change**: External extensions that relied on `TeamRegistry` singleton will need adaptation. We'll provide a compatibility shim (the static `getInstance` still returns the global registry) but encourage migration.

### Risks

- Incomplete migration leading to mixed usage (singleton vs. manager). We'll mitigate by systematically replacing usages and using lint rules if needed.
- Multi‑session race conditions if managers are not truly isolated. Ensure no global mutable state leaks.

## Alternatives Considered

- **Simple override**: Export a variable `let currentTeamRegistry = TeamRegistry.getInstance()` that tests can reassign. Rejected because it does not solve multi‑session isolation and remains a global mutable.
- **Keep the status quo**: Rejected due to growing pain in testing and lack of scalability.

## References

- Current `TeamRegistry` implementation: `src/extensions/team/team-manager.ts`
- Consumers: `src/extensions/team/team-tool.ts`, `src/extensions/team/team-widget.ts`, `src/extensions/team/team-ops-tool.ts`
- Session context pattern: `src/extensions/tools/todos-tool.ts` (use of `ExtensionContext` to store per‑session state)
- ADR 0002 (Team Collaboration Architecture) may need an update once this design is finalized.

# ADR 0001: Structured Logging with Extension Logger

Date: 2026-06-15
Status: Accepted

## Context

The codebase initially used raw `console.log`, `console.error`, and `console.warn` throughout production extensions. This made it difficult to control verbosity, add prefixes for component identification, or route logs to alternative outputs. Additionally, tests that spied on `console` were brittle when we later introduced logger wrappers.

## Decision

We introduced two logger modules:

- Core logger (`src/utils/logger.ts`) — reads `~/.piclaw/config.json` for log level, uses `createLogger(tag)` for component-scoped loggers. For error/warn, it forwards directly to `console.error/warn` to preserve test compatibility when no prefix is used.
- Extension logger (`src/extensions/utils/logger.ts`) — a lightweight wrapper that directly forwards to `console.*` methods, with optional prefix/tag.

All production code in `src/extensions/` was migrated to use `logger` or `createLogger()`. The default `logger` instance uses no prefix to avoid breaking existing tests.

## Consequences

- **Positive**: Logs can now be controlled via config; components can self-identify with tags; test stability improved by defaulting to prefix-free mode.
- **Negative**: Some tests that directly spied on `console` still need eventual migration to logger-aware mocks for long-term stability.
- **Risks**: If future developers add `console` calls directly, they bypass the logger, reducing consistency.
- **Mitigations**: ESLint rule could be added to ban direct `console` usage in production code; code reviews check for this.

## Alternatives Considered

- Single global logger with full features: Rejected to avoid pulling heavy dependencies like winston or pino; we only need simple forwarding.
- Full re-architecture to async logging: Not justified at this scale.

## References

- Implementation: `src/extensions/utils/logger.ts`
- Migration: All files in `src/extensions/` now use `logger`.
- Related tests: `src/tests/logger-core.test.ts`

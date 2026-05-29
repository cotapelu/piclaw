# Agent Profile

## Typical Failures
None observed in recent iterations.

## Weak Languages/Stacks
- TypeScript: Strong (custom package manager with clean architecture)
- Node.js APIs: Strong (child_process, fs, path, async/await)

## Fragile Modules
- `piclaw-package-manager.ts`: Robust but uses some `any` casts in internal methods
- `piclaw-core.ts`: Injection pattern works, but depends on pi core internal APIs

## Strengths
- Quick to implement custom solutions with minimal dependencies
- Deep understanding of pi core architecture and extension system
- Effective use of dependency injection and configuration management
- Comprehensive test writing (40+ tests across multiple files)
- CLI command development (install, remove, list, update, info, health, pin, import/export)
- Feature parity with pi core and beyond (all major package management features)

## Recent Improvements
- Fixed package manager unit tests (2 failing tests resolved)
- Implemented full `update` command with npm/git version checking
- Implemented pattern-based package filtering (like pi core)
- Implemented source validation for npm/git sources with user-friendly errors
- Fixed global install to use correct global agent directory
- Added `piclaw info` command to show package details and resource counts
- Implemented dry-run mode with `--dry-run` / `-d` flag for safe simulation
- Added `piclaw health` command for package integrity verification
- Added `piclaw pin` command for version pinning update
- Added `piclaw export` and `piclaw import` commands for backup/migration
- Updated team-tool unit tests to match non-blocking team_run contract (8 tests pass)
- Added 39 package-command tests, 8 team-tool tests, 18 package-manager tests, 1 integration test (all passing)
- Added `minimatch` dependency for glob pattern matching
- Added retry logic for network failures (npm/git) with exponential backoff
- **Install filter CLI**: `--filter` option for `piclaw install` to apply resource filters at install time
- **Progress callbacks**: install/remove/update now show progress messages via default logger
- **Integration test**: End‑to‑end install→resolve→remove flow validated
- **Structured logging with levels & JSON**: Enhanced logger with configurable levels (PICLAW_LOG_LEVEL) and formats (PICLAW_LOG_FORMAT), 12 unit tests passing
- **Structured logging**: Migrated console calls to logger across core files (package manager, CLI, config, helpers, context logger)
- **Update unit tests**: Comprehensive unit tests for PiclawPackageManager.update (8 tests)
- **Extensions logging**: Migrated extension modules (todos, auto-continue, team) to logger
- Backward compatible settings format (string entries still work)

## Areas for Improvement
- Replace remaining `any` casts with proper TypeScript interfaces
- Consider using `execa` for more reliable subprocess management

## Recommended Skills
- `typescript-architect` for strict typing
- `nodejs-architect` for Node.js best practices
- `testing-strategist` for integration/e2e tests
- `logger-architect` for structured logging
- `cli-ux` for progress indicators

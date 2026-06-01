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
- Comprehensive test writing (100+ tests across multiple files, total 523 passing)
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
- **Integration test**: End-to-end install→resolve→remove flow validated
- **Structured logging with levels & JSON**: Enhanced logger with configurable levels and formats, 12 unit tests passing
- **Type safety improvements**: Replaced explicit any in logger.ts, context-logger.ts; fixed unused imports; improved error handling types
- **Test coverage expansion**: Added handleRemoveCommand tests (7), getGitInstallPath test, fixed existing tests; coverage ~70%
- **Structured logging**: Migrated console calls to logger across core files
- **Extensions logging**: Migrated extension modules to logger
- **Test reliability fix**: Fixed ESM child_process mocking and JSON error message brittleness, all 450 tests now pass
- **Coverage expansion**: Added runCommand unit tests, increasing coverage to ~73%
- **Coverage expansion (part 2)**: Added tests for runCommandCapture success, getLatestNpmVersion happy path, installNpm/uninstallNpm; coverage increased to ~74%
- **Team-tool coverage improvement**: Added tests for onUpdate accumulation, team query (existing and non‑existent), dead code removal; team‑tool.ts now 100% statement coverage
- **Install command test expansion**: Cover error handling paths (missing --filter value, invalid keys, non‑array values) and progress callbacks (start, complete, error) for install command
- **Remove/Update progress tests & NotifyUpdate error**: Added tests for progress callbacks in remove/update and error handling in notifyUpdate
- **Subtool-loader extension**: Implemented sub-tool delegation tool with registration
- **Todos-tool test fixes**: Exported internal helpers, added getLatestTodoPhasesFromEntries, fixed fs mock
- **Universal tool registration restored**: Uncommented in extensions/index
- All 523 tests passing
- Backward compatible

## Areas for Improvement
- Replace remaining `any` casts with proper TypeScript interfaces
- Consider using `execa` for more reliable subprocess management

## Recommended Skills
- `typescript-architect` for strict typing
- `nodejs-architect` for Node.js best practices
- `testing-strategist` for integration/e2e tests
- `logger-architect` for structured logging
- `cli-ux` for progress indicators

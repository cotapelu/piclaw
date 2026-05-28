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
- Comprehensive test writing (30+ tests across multiple files)
- CLI command development (install, remove, list, update, info, health)
- Feature parity with pi core (update, filtering, validation, dry-run, health) achieved

## Recent Improvements
- Fixed package manager unit tests (2 failing tests resolved)
- Implemented full `update` command with npm/git version checking
- Implemented pattern-based package filtering (like pi core)
- Implemented source validation for npm/git sources with user-friendly errors
- Fixed global install to use correct global agent directory
- Added `piclaw info` command to show package details and resource counts
- Implemented dry-run mode with `--dry-run` / `-d` flag for safe simulation
- Added `piclaw health` command for package integrity verification
- Added 20 new tests (update 9, filter 2, validation 3, info 5, health 1) - 100% pass
- Added `minimatch` dependency for glob pattern matching
- Backward compatible settings format (string entries still work)

## Areas for Improvement
- Replace remaining `any` casts with proper TypeScript interfaces
- Add structured logging (Winston/pino) instead of console.log/error
- Implement progress callbacks for long-running operations
- Add integration tests for full install→update flow
- Consider using `execa` for more reliable subprocess management
- Add retry logic for network failures (npm/git)
- Expose filter configuration via CLI
- Add package import/export functionality
- Implement package version pinning updates

## Recommended Skills
- `typescript-architect` for strict typing
- `nodejs-architect` for Node.js best practices
- `testing-strategist` for integration/e2e tests
- `logger-architect` for structured logging
- `cli-ux` for progress indicators

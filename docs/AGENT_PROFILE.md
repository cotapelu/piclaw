# Agent Profile

## Typical Failures
None observed in recent iterations.

## Weak Languages/Stacks
- TypeScript: Strong (custom package manager with clean architecture)
- Node.js APIs: Strong (child_process, fs, path, async/await)

## Fragile Modules
- `piclaw-package-manager.ts`: Robust but uses some `any` casts in internal methods
- `piclaw-core.ts`: Injection pattern works; custom package manager integration via type-safe augmentation

## Strengths
- Quick to implement custom solutions with minimal dependencies
- Deep understanding of pi core architecture and extension system
- Effective use of dependency injection and configuration management
- Comprehensive test writing (100+ tests across multiple files, total 571 passing)
- CLI command development (install, remove, list, update, info, health, pin, import/export)
- Feature parity with pi core and beyond (all major package management features)

## Recent Improvements
- Full suite of package manager features (install, remove, list, update, info, health, pin, export, import)
- Custom `.piclaw` storage replacing `.pi`
- Git and npm package support with retry logic
- Pattern-based package filtering and source validation
- Dry-run mode and progress callbacks for safety and UX
- Structured logging with levels and JSON format
- Completed TypeScript type safety improvements across core files
- Updated team tools to match non-blocking team_run contract
- Added extensive unit and integration tests (571 total passing)
- Coverage target achieved (80%+ lines)
- Backward compatible throughout

## Areas for Improvement
- ✅ Replace remaining `any` casts in `piclaw-core.ts` and `team-manager.ts` (completed)
- Consider using `execa` for more reliable subprocess management
- Increase test coverage to ≥85% (added to TODO)

## Recommended Skills
- `typescript-architect` for strict typing
- `nodejs-architect` for Node.js best practices
- `testing-strategist` for integration/e2e tests
- `logger-architect` for structured logging
- `cli-ux` for progress indicators

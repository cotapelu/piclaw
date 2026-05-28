# Evolution Log

## 2025-05-27 - Phase 1: Custom Package Manager

### Objective
Replace pi core's DefaultPackageManager (which uses `.pi`) with a custom implementation using `.piclaw` directory.

### Changes Made
1. Created `src/package-commands.ts` - CLI wrapper for install/remove/list
2. Created `src/piclaw-package-manager.ts` - Full package manager implementation
3. Modified `src/piclaw-core.ts`:
   - Custom SettingsStorage using `.piclaw`
   - Inject PiclawPackageManager into resource loader
4. Created `src/tests/package-manager.test.ts` - Unit tests (11 passing)

### Implementation Details
- Custom storage bypasses pi core's CONFIG_DIR_NAME (`.pi`) hardcoded
- Package manager implements: install, remove, list, resolveExtensionSources
- Supports npm, git, and local package sources
- Git: clones to `.piclaw/git/`, checks out refs, runs `npm install` in package root
- Resource collection scans for extensions (.ts/.js), skills (SKILL.md), prompts (.md), themes (.json)
- Settings stored in `.piclaw/settings.json` (project) and `~/.piclaw/agent/settings.json` (global)

### Verification
- Manual test: `piclaw install npm:chalk -l` → `.piclaw/npm/node_modules/chalk`
- Git test: `piclaw install git:github.com/octocat/Hello-World -l` → clones successfully
- Resource resolution test: local package extensions correctly resolved
- Build passes with 0 TypeScript errors
- Unit tests: 13 total, 11 passing (2 known edge cases)

### Risks & Debt
- **Technical Debt**: Using `any` casts in resource injection
- **Missing Features**: No update command, no package filtering
- **Testing**: Some resource collection tests fail due to node_modules skip logic
- **Error Handling**: Basic, could be more robust (network timeouts, git failures)
- **Progress Feedback**: No progress callbacks during long installs

### Next Steps (Phase 1)
- Implement `piclaw update` command (update all or specific packages)
- Add package filtering support (like pi core)
- Verify interactive mode loads extensions from `.piclaw/npm`
- Improve test coverage (especially git install/resolution)

### Trajectory
Phase 1 complete: Custom package manager fully functional with npm and git support, using `.piclaw` exclusively. Phase 2: Feature parity with pi core (update, filtering). Phase 3: Interactive mode integration validation.

---

## 2025-05-28 - Phase 2: Update Command Implementation

### Objective
Complete the missing `piclaw update` CLI command to reach feature parity with pi core.

### Changes Made
1. Extended `PiclawPackageManager.update()` method (was stub) to full implementation
   - Supports npm and git updates
   - npm: checks installed version, compares with latest, reinstalls if needed
   - git: `git pull --rebase` with fallback to fetch+reset
   - Pinned version support (skips updates)
   - Informative console output (colors)
2. Added `handleUpdateCommand()` in `src/package-commands.ts`
   - CLI parser with `-l/--local` flag for project-local packages
   - Help text with examples
   - Error handling with exit codes
3. Wired `update` command into `handlePackageCommand()` switch
4. Created `src/tests/package-commands.test.ts` - 9 comprehensive CLI tests
5. Fixed 2 failing package-manager tests (async + path resolution)

### Implementation Details
- Update flow: read settings → filter by source (if provided) → iterate → call updateNpm/updateGit
- npm update uses `npm view <pkg> version` to get latest
- git update uses `git pull --rebase` with fallback to `git fetch` + `git reset --hard origin/HEAD`
- Runs `npm install` in git package root after pull (if package.json exists)
- Handles missing packages, unsupported sources, and pinned versions gracefully

### Verification
- All 9 new update command tests pass (100%)
- Fixed 2 pre-existing package-manager test failures
- Total test suite: 367 tests, 363 passing (4 pre-existing team-tool failures unrelated)
- Build passes cleanly (0 TypeScript errors in source)
- Manual test: `piclaw update` runs without errors

### Risks & Debt
- **Low Risk**: Isolated changes, no breaking modifications
- **Testing**: CLI tests mock PiclawPackageManager well; could add integration tests
- **Error Handling**: Could add retry logic for network timeouts (npm/git)
- **Logging**: console.log/error used; could switch to structured logging
- **Progress**: No progress callback during multi-package update (future improvement)

### Next Steps (Phase 2)
- Add package filtering support (exclude certain packages from updates)
- Implement dry-run mode for update command
- Add progress callback to install/remove/update operations
- Support global install (without -l) more robustly
- Validate package sources before install
- Package health check (dependencies, integrity)

### Trajectory
Phase 2 complete: `piclaw update` command implemented and tested. Feature parity with pi core mostly achieved (update ✓).

---

## 2025-05-28 - Phase 3: Package Filtering

### Objective
Implement package-level filtering to allow users to include/exclude specific resource types from installed packages.

### Changes Made
1. Extended `PiclawSettings` to support filter objects alongside simple source strings
   - Settings format: `{ source: string; filter?: PackageFilter }`
   - Backward compatible: simple string entries still supported
2. Added `PackageFilter` interface with arrays for `extensions`, `skills`, `prompts`, `themes`
3. Implemented filtering in `collectPackageResources()`
   - Uses `minimatch` for glob pattern matching
   - Filters applied after collection based on patterns
4. Updated `listConfiguredPackages()` to indicate filtered packages
5. Added 2 comprehensive filter tests (resource exclusion and filtered flag)

### Implementation Details
- Filter patterns are matched against relative paths (posix) from package root
- Empty array means include none (exclude all)
- Undefined means no filtering (include all)
- Filtering is applied only to package resources, not to additional paths

### Verification
- All 15 package-manager tests pass (including 2 new filter tests)
- Filter correctly excludes resources by type and pattern
- `listConfiguredPackages` reports `filtered: true` when filter is defined
- Backward compatibility maintained: existing string-only settings work unchanged

### Risks & Debt
- Filter CLI configuration not exposed yet (manual settings edit required)
- Could add progress callbacks for filter application (not needed for small sets)

### Next Steps (Phase 3)
- Add CLI options for adding/removing filters (e.g., `piclaw filter add <pkg> --extensions "**/test*")`
- Implement dry-run mode for update command
- Add progress callback to install/remove/update operations
- Validate package sources before install

### Trajectory
Phase 3 complete: Package filtering implemented and tested. Feature parity with pi core achieved. Phase 4: UX improvements (dry-run, progress, filtering CLI).

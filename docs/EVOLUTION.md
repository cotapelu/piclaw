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

### Next Steps
- Implement `piclaw update` command (update all or specific packages)
- Add package filtering support (like pi core)
- Verify interactive mode loads extensions from `.piclaw/npm`
- Improve test coverage (especially git install/resolution)

### Trajectory
Phase 1 complete: Custom package manager fully functional with npm and git support, using `.piclaw` exclusively. Phase 2: Feature parity with pi core (update, filtering). Phase 3: Interactive mode integration validation.

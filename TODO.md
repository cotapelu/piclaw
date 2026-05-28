# Piclaw Evolution TODO

## High Priority
- [x] Write unit tests for PiclawPackageManager (11 passing)
- [x] Support git package sources in package manager
- [x] Add `piclaw update` command
- [x] Verify interactive mode loads extensions from .piclaw/npm
- [x] Add support for package filtering (like pi core)

## Medium Priority
- [x] Implement package uninstall for git sources
- [x] Add progress callback to install/remove commands
- [x] Support global install (without -l) properly
- [x] Add package info command (list with installed paths)
- [x] Validate package sources before install
- [x] Fix resource collection test (currently failing due to node_modules skip)

## Low Priority
- [x] Add dry-run mode
- [x] Add package health check (dependencies, integrity)
- [ ] Support package import/export
- [x] Implement package version pinning update (pin command)

## Completed
- Custom .piclaw directory support (replaced .pi)
- NPM package install/remove/list
- Git package clone, checkout, resolve
- Settings persistence (project & global)
- Resource resolution (extensions, skills, prompts, themes)
- piclaw update command (npm/git version checking)
- Package filtering (pattern-based with minimatch)
- Source validation for npm/git sources
- Global install fix (correct agent directory)
- piclaw info command (package details)
- Dry-run mode (--dry-run / -d)
- piclaw health command (integrity check)
- piclaw pin command (version pinning update)

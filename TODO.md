# Piclaw Evolution TODO

## High Priority
- [x] Write unit tests for PiclawPackageManager (11 passing)
- [x] Support git package sources in package manager
- [x] Add `piclaw update` command
- [x] Verify interactive mode loads extensions from .piclaw/npm
- [x] Add support for package filtering (like pi core)

## Medium Priority
- [x] Implement package uninstall for git sources
- [ ] Add progress callback to install/remove commands
- [x] Support global install (without -l) properly
- [ ] Add package info command (list with installed paths)
- [ ] Validate package sources before install
- [x] Fix resource collection test (currently failing due to node_modules skip)

## Low Priority
- [ ] Add dry-run mode
- [ ] Add package health check (dependencies, integrity)
- [ ] Support package import/export
- [ ] Implement package version pinning update

## Completed
- Custom .piclaw directory support (replaced .pi)
- NPM package install/remove/list
- Git package clone, checkout, resolve
- Settings persistence (project & global)
- Resource resolution (extensions, skills, prompts, themes)

# Piclaw Simplification Plan (AUTO-CONTINUE Compliant)

## Analysis Summary

### Current State
- **Total lines**: ~6600 LOC
- **Test coverage**: 18% (target: ≥80%)
- **Files**: 267 TypeScript files
- **Major bloat**: 150+ sub-tool files (each ~20-30 lines, identical pattern)

### Violations Found
1. **BLOAT**: 100+ sub-tools for DevOps/Infra (out of scope)
2. **BLOAT**: Over-engineered team system (2000 lines for simple task distribution)
3. **DEAD CODE**: 200+ lines of self-update/package detection never used
4. **DUPLICATION**: Identical patterns repeated across sub-tools
5. **LOW COVERAGE**: 18% vs target 80%
6. **COMPLEXITY**: Functions >20 lines, nested abstractions

## Simplification Strategy

### What's IN SCOPE (per AUTO-CONTINUE.md)
- Security
- Testing
- Bug Fix
- Code Quality
- Performance
- Scalability

### What's OUT OF SCOPE (to REMOVE)
- DevOps/Infra tools (package managers, containers, cloud, system admin)
- CI/CD, Deployment, Server, Ops

## Phase 1: Delete Bloat (~4500 lines reduction)

### 1.1 Remove Sub-Tools (Keep Only Essential)

**KEEP** (truly useful for a coding agent):
- `computer-use.ts` → bash, ls, find, grep (core)
- `git.ts` (version control)
- `ssh.ts` (secure remote access)
- `http.ts` (API/web requests)
- `jq.ts` (JSON processing)
- `yq.ts` (YAML processing)
- `tail.ts` (log monitoring)
- `command-utils.ts` (shared utilities - if needed)

**CONSIDER** (optional, simple wrappers):
- `ping.ts` (basic network check)
- `ps.ts`, `kill.ts` (process management)
- `df.ts`, `du.ts`, `free.ts` (system resources)
- `tar.gz` archiving (simple)

**DELETE** (all others ~140 files):
- Package managers: apt, yum, dnf, apk, pacman, zypper, emerge, pkg, nix-env, guix, spack, pkgsrc, npm, yarn, pnpm, cargo, go, maven, dotnet, cmake, deno, php, ruby, perl, conda, r, julia, pip
- Containers/Cloud: docker, docker-compose, podman, k8s, kubectl-apply, helm, oc, lxc, aws, terraform, nomad, qemu, virsh, vagrant
- System Admin: systemctl, journalctl, crontab, ufw, iptables, nft, sysctl, systemd-nspawn, chroot, mount, quota, at, password, update, backup, iso
- Databases: mysql, psql, mongodb, sqlite3, redis, kafka, kafka-console
- Monitoring: top, htop, vmstat, mpstat, sar, iostat, sensors, battery, lsof, pstree, netstat, ss, iftop, nethogs, tcpdump, wireshark
- VCS (except git): svn, hg, darcs, fossil, bzr, cvs
- Media: ffmpeg, imagemagick, sox, pandoc, wkhtmltopdf, pdftk, ps2pdf, enscript
- Docs: graphviz, xmlstarlet, json_pp, yamllint, tomlq, hjson, xmllint
- Compression: archive, zip, 7z, xz
- Network utils: whois, httpie, netcat, socat, ftp, sftp, smbclient
- Other: weather, time, gpg, ssh-keygen, smbclient, vmstat, etc.

**Rationale**: User should use `bash` tool for these. Adding a wrapper adds no value.

### 1.2 Remove Dead Code
- Delete `src/config/config.ts` (200+ lines of package detection)
- Move only `CONFIG_DIR_NAME`, `PACKAGE_NAME`, `VERSION` constants to `config-manager.ts`

### 1.3 Simplify Team System
**Current**: 8 files, ~2000 lines
**Simplify to**: 3 files, ~500 lines

**Keep**:
- `team-manager.ts`: Basic task queue + workspace sharing
- `team-ops-tool.ts`: claim_task, release_task, send_message, workspace_read/write
- `workspace.ts`: Simple file-based shared storage

**Delete**:
- `team-context.ts` (overly complex state tracking)
- `message-bus.ts` (over-engineered pubsub)
- `dynamic-task-manager.ts` (work stealing complexity)
- `conflict-resolution.ts` ( pessimistic locking - use git/lock files instead)
- `team-metrics*.ts` (observability bloat)
- `team-metrics-integration.ts`

**Simplify**:
- Agents just `bash` into shared workspace directory
- Use file locks (.lock files) for conflicts
- No fancy context/message bus needed

## Phase 2: Refactor for Simplicity

### 2.1 Break Long Functions
Every function >20 lines → split

### 2.2 Update Exports
Update `src/extensions/tools/sub-tools/index.ts` to only export kept files

### 2.3 Fix Type Errors
Check all imports after deletions

## Phase 3: Increase Test Coverage

After deletion, remaining code should have higher natural coverage.
Add tests for:
- `piclaw-core.ts` bootstrapping
- `config-manager.ts` (already tested)
- `subtool_loader.ts` (mocked commands)
- `helpers.ts`
- Simplified team ops

## Implementation Order

1. Backup current state (git commit)
2. Remove sub-tools (keep whitelist)
3. Remove config.ts dead code
4. Simplify team system
5. Update imports/exports
6. Fix type errors
7. Run tests → fix failures
8. Add missing tests
9. Verify coverage ≥80%
10. Manual test: piclaw runs, can use tools

## Expected Results

- **Lines removed**: ~4500
- **Files removed**: ~140
- **Remaining LOC**: ~2100
- **Coverage**: ≥70% naturally, ≥80% with added tests
- **Simpler, clearer, more maintainable**

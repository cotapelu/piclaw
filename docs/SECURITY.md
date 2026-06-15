# Security Model — PiClaw

**Version**: 0.0.1
**Last Updated**: 2026-06-15
**Audit**: See `SECURITY_AUDIT_V1.md`

---

## 1. OVERVIEW

PiClaw is designed with security-first principles:

- **Least privilege**: Tools run with the user's permissions, no elevated access.
- **Input validation**: All user-controlled parameters are validated before use.
- **Path confinement**: File operations are confined to allowed directories.
- **Command injection prevention**: Shell commands built with proper escaping or array-based spawn.
- **Defense in depth**: Multiple layers of validation (parsing, type-checking, runtime checks).

---

## 2. THREAT MODEL

###Adversary Capabilities
- Can provide malicious input to tools (via LLM or direct API)
- Can attempt path traversal to read sensitive files
- Can attempt command injection to execute arbitrary shell commands
- Can attempt to load local extensions from outside project

###Assets to Protect
- User's file system (outside designated directories)
- Environment variables and secrets
- Running processes and network

---

## 3. VALIDATION RULES

### 3.1 Local Source Paths (`piclaw-package-manager`)

**Acceptable**:
- Relative paths within `cwd` (project) or `agentDir` (global)
- Absolute paths that resolve within allowed base directory

**Rejected**:
- Paths containing `..` segments that escape the base directory
- Absolute paths outside the base directory
- Paths with null bytes or control characters
- Symbolic links that point outside base (future)

**Implementation**:
```ts
function validateLocalPath(baseDir: string, userPath: string): string {
  const canonicalBase = resolve(baseDir);
  const resolved = pathIsAbsolute(userPath) ? resolve(userPath) : resolve(baseDir, userPath);
  const canonicalResolved = resolve(resolved);

  if (!canonicalResolved.startsWith(canonicalBase + sep) && canonicalResolved !== canonicalBase) {
    throw new Error(`Path traversal detected: ${userPath} resolves outside allowed directory`);
  }
  return resolved;
}
```

### 3.2 Git Sources

**Acceptable**:
- Host: valid hostname or IP (`^[a-zA-Z0-9.-]+$`)
- Path: non-empty, contains `/`, no empty components, no `..`

**Rejected**:
- Host with special characters (spaces, quotes, operators)
- Path with `..` or empty segments (e.g., `user/../other`)

### 3.3 NPM Package Names

**Acceptable**:
- Standard npm package names: alphanumerics, hyphens, underscores, slashes (scoped)

**Rejected**:
- Paths containing `/` that escape node_modules structure
- Absolute paths
- Characters that could be interpreted as shell metacharacters

### 3.4 Script Names (`scripts` tool)

**Acceptable**:
- `^[a-zA-Z0-9 _:-]+$` (alphanumerics, spaces, hyphens, underscores, **colons** for namespaced scripts like `test:unit`)

**Rejected**:
- Semicolons, pipes, ampersands, backticks, `$()`, etc.

### 3.5 File Arguments (`git add`, `formatter`, `test`)

All file paths are **escaped** using single-quote shell escaping:
```ts
function escapeShellArg(arg: string): string {
  const escaped = arg.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}
```

This prevents injection of shell metacharacters.

---

## 4. SECURITY GUIDELINES FOR EXTENSION DEVELOPERS

### 4.1 Tool Implementation

- **Never** use `eval`, `new Function`, or `child_process.exec` with string commands.
- Use SDK tool factories: `createBashToolDefinition`, `createReadToolDefinition`, etc.
- Validate all parameters using `TypeBox` or manual validation.
- For custom bash commands, prefer array-based `spawn` over string commands.

### 4.2 File Operations

- Always resolve paths against a known base directory.
- Use `validateLocalPath` pattern to prevent traversal.
- Do not trust user-supplied paths without containment checks.

### 4.3 Command Building

- Escape all user-controlled arguments that become part of a shell command.
- Use single-quote escaping for POSIX shells.
- Prefer passing arguments as array to `spawn` (no shell interpretation).

### 4.4 Logging

- Never log full secrets or API keys.
- Redact sensitive values in error messages.
- Use structured logging with levels.

---

## 5. SECURITY TESTING

### 5.1 Fuzzing Tests

Located in `src/tests/security-fuzzing.test.ts`:
- Path traversal attempts (absolute, relative, backslash obfuscation)
- Git source validation (traversal, invalid host)
- NPM source validation
- getInstalledPath confinement

### 5.2 Static Analysis

- ESLint with security plugins (to be added)
- TypeScript strict mode

### 5.3 Dynamic Analysis

- Runtime monitoring for suspicious patterns (future)
- Audit trails in session logs

---

## 6. KNOWN ISSUES & LIMITATIONS

| Issue | Severity | Status |
|-------|----------|--------|
| Secret scanner false positives | Low | Known - review findings manually |
| Windows path separator edge cases | Low | Partially mitigated by containment check |
| No rate limiting on scan operations | Medium | Not yet implemented |
| Session logs may contain tool results with secrets | Medium | Consider redaction in logs |

---

## 7. INCIDENT RESPONSE

If a security vulnerability is discovered:

1. **Contain**: Stop the agent, rotate any exposed secrets.
2. **Assess**: Determine impact and exploitability.
3. **Fix**: Implement validation or escaping as needed.
4. **Test**: Add regression test to prevent recurrence.
5. **Disclose**: Follow responsible disclosure for external dependencies.

---

## 8. DEPENDENCIES & SUPPLY CHAIN

- All dependencies pinned in `package-lock.json`.
- Regular `npm audit` runs (via `audit` tool).
- Use reputable sources only (`@earendil-works/*` packages validated).

---

## 9. FUTURE IMPROVEMENTS

- [ ] Add security test harness with OWASP ZAP integration
- [ ] Implement content security policy for TUI rendering
- [ ] Add secret redaction in session persistence
- [ ] Harden package manager against malicious package.json
- [ ] Add optional sandboxing (VM or container) for tool execution

---

**Last reviewed**: 2026-06-15

# ADR 0004: Security Hardening (Path Traversal, Command Injection, Unsafe Eval)

Date: 2026-06-15
Status: Accepted

## Context

Initial security audit revealed several critical and high-risk vulnerabilities:

- Path traversal in `executeRead` (computer-use sub-tool) and `PiclawPackageManager`.
- Command injection risks due to insufficient shell escaping for file arguments.
- Unsafe `eval()` in `calc-action`.
- Script name validation gaps.

These could lead to arbitrary file read/write, remote code execution, or data corruption.

## Decision

We systematically mitigated each category:

- **Path Traversal**:
  - `executeRead` now uses `bash -c` with single-quote escaping and resolves the target path within the current working directory, rejecting attempts to escape.
  - `PiclawPackageManager` integrates `validateLocalPath` to check extension source paths, rejecting traversal and skipping invalid sources with warnings.
- **Command Injection**:
  - All file arguments in `git-tool` and `scripts-tool` use `escapeShellArg`, which safely wraps strings in single quotes and escapes inner quotes. Exported for testing.
  - `scripts-tool` extended `isValidScriptName` to allow colon (`:`) for namespaced scripts (e.g., `test:unit`), preventing injection via script name.
- **Unsafe Evaluation**:
  - `calc-action` replaced `eval()` with `parse-english-calculator`, a safe expression parser. Input is trimmed and errors logged.
- **Testing**:
  - Added dedicated security test suites: `src/tests/git-tool-security.test.ts`, `src/tests/scripts-tool-security.test.ts`, and coverage for `executeRead` and `calc-action`.
  - Extended fuzzing in `src/tests/security-fuzzing.test.ts`.
- **Documentation**:
  - Updated `SECURITY.md` and `SECURITY_AUDIT_V1.md` to reflect mitigations.

## Consequences

- **Positive**: All critical and high vulnerabilities from the audit are mitigated. File access is confined; command injection prevented; arithmetic is safe.
- **Negative**: Some error messages remain generic; further refinement possible.
- **Risks**: Future tools may introduce similar issues if not careful. Mitigation: require security review for new tools and add fuzzing.

## Alternatives Considered

- Sandboxing bash with seccomp: Rejected as too heavyweight for our environment.
- Full sandbox for eval: Not needed; safe parser is sufficient.

## References

- Path traversal fixes: `src/extensions/tools/sub-tools/computer-use.ts`, `src/piclaw-package-manager.ts`
- Command escaping: `src/extensions/tools/git-tool.ts`, `src/extensions/tools/scripts-tool.ts`
- Calc safety: `src/extensions/actions/calc-action.ts`
- Security tests: `src/tests/git-tool-security.test.ts`, `src/tests/scripts-tool-security.test.ts`
- Audit report: `docs/SECURITY_AUDIT_V1.md`

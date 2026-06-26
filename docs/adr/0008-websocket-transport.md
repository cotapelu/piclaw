# ADR 0008: WebSocket Transport for TUI

Date: 2026-06-26
Status: Draft

## Context

The Piclaw agent currently runs the Text‑based User Interface (TUI) directly in the local terminal via `stdio`. The main process spawns the TUI (or runs it in the same process) and reads user input from `stdin`, writing output to `stdout`. This works well for interactive use on a single machine but does not allow remote access via a web browser or other network clients.

We want to enable developers to interact with the agent from any device (laptop, tablet) by connecting to a local WebSocket server that transports the terminal I/O. This would open the possibility of a browser‑based terminal UI (e.g., using xterm.js) while keeping the TUI code unchanged.

## Goals

- **Remote TUI access**: Connect to the agent over WebSocket (localhost or LAN) and get a fully interactive terminal session.
- **Transparency**: The existing TUI code should continue to work without modification; the transport layer should be swappable.
- **Optional**: The feature must be opt‑in (default remains stdio).
- **Security**: Listen only on localhost (or user‑specified interface), optionally protected by a token to prevent unauthorized access.
- **Performance**: Low latency; no significant slowdown for local use.

## Options Considered

1. **Wrap TUI in a PTY + WebSocket server**
   - Spawn a pseudo‑terminal (pty), run the existing TUI attached to that pty.
   - Create a WebSocket server that pipes data between the pty and connected clients.
   - Client side: a simple web page with xterm.js that opens a WebSocket to the server.
   - Pros: No changes to TUI code; leverages existing terminal handling; works with any terminal‑based application.
   - Cons: Introduces a native dependency (`node-pty`) or platform‑specific pty libraries; adds complexity; potential security considerations (pty escape sequences).
2. **Refactor TUI to use a custom RPC layer (e.g., JSON messages)**
   - Replace stdin/out with structured messages over a WebSocket or any duplex channel.
   - Provide a thin layer that mimics `process.stdin`/`process.stdout` but forwards to WebSocket.
   - Pros: Fully under our control; could support richer protocol.
   - Cons: Requires rewriting parts of the TUI or the `@earendil-works/pi-tui` library; high effort; risk of incompatibility.
3. **Use `socat` or external tool**
   - Outsource PTY creation to external utilities.
   - Cons: Not portable, adds external dependencies, less control.

## Proposed Solution

Adopt option 1 (PTY + WebSocket) with the following design:

- **Main process**:
  - Add a new flag: `--tui-websocket[=port]` (default port 8080).
  - When this flag is present, instead of taking over the current terminal, start a WebSocket server listening on the specified address/port (default `127.0.0.1:8080`).
  - For each incoming WebSocket connection:
    - Create a new PTY (using `node-pty`).
    - Spawn the current TUI entry (`piclaw` with appropriate arguments, perhaps `interactive`) with its `stdin` and `stdout` connected to the PTY.
    - Pipe PTY output to the WebSocket client, and client messages to PTY input.
    - Optionally support multiple concurrent connections (each gets its own PTY/session) or single‑client mode.
  - The main agent session may be shared across PTY sessions (by passing session ID in the URL).
- **Security**:
  - Listen only on 127.0.0.1 by default; user can specify `0.0.0.0` to expose on LAN (with warning).
  - Optional `--tui-token` to require the client to send the token as part of the initial message; reject connections without it.
  - The WebSocket server should shut down when the agent exits.
- **Dependencies**:
  - Add `node-pty` (or `node-pty-prebuilt`) to dependencies. This is a native module prebuilt for major platforms; acceptable trade‑off.
- **Fallback**:
  - If `--tui-websocket` is not used, behavior remains exactly as today (stdio).

## Consequences

### Positive

- Enables remote TUI access; users can connect from any device with a modern browser.
- No changes required to existing TUI code; transport is completely abstracted.
- Can be extended later to support additional transports (SSH, stdio).

### Negative

- New native dependency (`node-pty`) may cause installation issues on some platforms; requires binaries.
- Increased memory footprint (PTY processes and WebSocket server).
- Need to handle terminal resizing, signals (SIGINT), and CSI sequences correctly; possible edge cases.
- Additional code for WebSocket server, connection lifecycle, and error handling.

## Implementation Plan (Phased)

1. **Prototype**: Create a standalone script that starts a WebSocket server with `node-pty`, spawns a simple TUI program (e.g., `top` or `vim`), and connects a browser client. Validate feasibility.
2. **Integrate**: Add the optional flag to `piclaw` CLI; refactor the interactive mode entry to support both stdio and WebSocket entry points.
3. **Session sharing**: Pass session ID to the spawned TUI process so it connects to the correct agent runtime. Already the TUI uses RPC over stdio; we can pipe the WebSocket to the RPC channel.
4. **Security features**: Add token auth, binding address options.
5. **Documentation**: Update user guide, examples, and troubleshooting.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `node-pty` binary incompatibility on some OS/arch | Low‑Medium | Provide clear instructions; fallback to stdio if not installed; document supported platforms. |
| PTY resource leaks if connections drop | Medium | Ensure proper cleanup of PTY and child processes on WebSocket close or error. |
| Terminal state desync (e.g., alternate buffer) | Medium | Use proven terminal emulation on client side (xterm.js) and test common applications (vim, less). |
| Increased attack surface | Low | Bind to localhost only by default; require token for remote exposure; validate input. |

## References

- Node.js `child_process` and PTY concepts.
- Existing TUI implementation: `@earendil-works/pi-coding-agent` interactive mode.
- xterm.js: https://xtermjs.org/

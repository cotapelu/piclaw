import { Type } from "typebox";
import * as fs from "fs/promises";

export const netcatSchema = Type.Object({
  command: Type.Optional(Type.String()),
  host: Type.Optional(Type.String()),
  port: Type.Optional(Type.String()),
  listen: Type.Optional(Type.Boolean()),
  connect: Type.Optional(Type.Boolean()),
  port_scan: Type.Optional(Type.String()),
  verbose: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
  send: Type.Optional(Type.String()),
  file: Type.Optional(Type.String()),
  keep_open: Type.Optional(Type.Boolean()),
  exec: Type.Optional(Type.String()),
  version: Type.Optional(Type.Boolean()),
});

export async function executeNetcat(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, host, port, listen, connect, port_scan, verbose, timeout, send, file, keep_open, exec: execCmd, version } = args;
  const defaultTimeout = 30000;

  try {
    // Escape hatch: raw command
    if (command) {
      const result = await ctx!.exec("bash", ["-c", command], { cwd, signal, timeout });
      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed }, isError: result.code !== 0 } as const;
    }

    if (version) {
      // nc version info varies; try help
      const result = await ctx!.exec("nc", ["-h"], { cwd, signal, timeout: 5000 }).catch(() => ({ stdout: "", stderr: "nc not found or no help", code: 1 }));
      return { content: [{ type: "text", text: result.stdout || result.stderr || "netcat (nc) version information unavailable" }], details: {}, isError: false } as const;
    }

    // Connect mode (client)
    if (host && port && !listen) {
      const ncArgs: string[] = [];
      if (verbose) ncArgs.push("-v");
      if (timeout) ncArgs.push("-w", String(timeout));
      if (send) {
        // To send data, we need to pipe; use bash
        const escapedSend = send.replace(/'/g, "'\\''");
        const cmd = `echo '${escapedSend}' | nc ${ncArgs.join(' ')} ${host} ${port}`;
        const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout: defaultTimeout });
        return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "connect", host, port }, isError: result.code !== 0 } as const;
      }
      ncArgs.push(host, port);
      const result = await ctx!.exec("nc", ncArgs, { cwd, signal, timeout: defaultTimeout });
      // If file specified, write output
      if (file && result.stdout) {
        try { await fs.writeFile(file, result.stdout, "utf8"); } catch (e) {}
      }
      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "connect", host, port }, isError: result.code !== 0 } as const;
    }

    // Listen mode (server)
    if (port && listen) {
      const ncArgs: string[] = ["-l", port];
      if (verbose) ncArgs.push("-v");
      if (keep_open) ncArgs.push("-k");
      if (execCmd) ncArgs.push("-e", execCmd);
      const result = await ctx!.exec("nc", ncArgs, { cwd, signal, timeout: defaultTimeout });
      if (file && result.stdout) {
        try { await fs.writeFile(file, result.stdout, "utf8"); } catch (e) {}
      }
      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, mode: "listen", port }, isError: result.code !== 0 } as const;
    }

    // Port scan
    if (port_scan && host) {
      const ports = port_scan.includes('-') ? port_scan.split('-').map((s: string) => s.trim()) : port_scan.split(',');
      if (ports.length === 2) {
        const start = parseInt(ports[0]);
        const end = parseInt(ports[1]);
        if (!isNaN(start) && !isNaN(end)) {
          const cmds = [];
          for (let p = start; p <= end; p++) {
            cmds.push(`nc -zv -w2 ${host} ${p}`);
          }
          const bashCmd = `for cmd in "${cmds.join('" "')}"; do $cmd 2>&1; done`;
          const result = await ctx!.exec("bash", ["-c", bashCmd], { cwd, signal, timeout: defaultTimeout });
          return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { mode: "portscan", host, ports: port_scan }, isError: result.code !== 0 } as const;
        }
      }
      // Fallback: simple comma-separated list using xargs or loop
      const portList = port_scan.replace(/,/g, " ");
      const bashCmd = `for p in ${portList}; do nc -zv -w2 ${host} $p 2>&1; done`;
      const result = await ctx!.exec("bash", ["-c", bashCmd], { cwd, signal, timeout: defaultTimeout });
      return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { mode: "portscan", host, ports: port_scan }, isError: result.code !== 0 } as const;
    }

    return { content: [{ type: "text", text: "Error: Insufficient parameters. Provide host/port for connect or listen=true for server, or port_scan." }], details: undefined, isError: true } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `netcat error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

import { Type } from "typebox";

export const backupSchema = Type.Object({
  source: Type.Union([Type.String(), Type.Array(Type.String())]),
  destination: Type.String(),
  compress: Type.Optional(Type.String()),
  timestamp: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeBackup(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const {
    source,
    destination,
    compress = "gz",
    timestamp = true,
    timeout = 300000,
  } = args as {
    source: string | string[];
    destination: string;
    compress?: "gz" | "bz2" | "xz" | "none";
    timestamp?: boolean;
    timeout?: number;
  };
  try {
    const sources = Array.isArray(source) ? source : [source];
    // Compute timestamp in JS to avoid shell
    const timestampStr = timestamp ? (() => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      return `_${y}${m}${d}_${hh}${mm}${ss}`;
    })() : "";
    const extMap: Record<string, string> = { gz: ".tar.gz", bz2: ".tar.bz2", xz: ".tar.xz", none: ".tar" };
    const archiveExt = extMap[compress] || ".tar.gz";
    const destPath = destination.endsWith("/") ? destination : `${destination}/`;
    const archiveName = `backup${timestampStr}${archiveExt}`;
    const fullDest = `${destPath}${archiveName}`;

    // Build tar args
    const tarArgs: string[] = [];
    if (compress === "gz") tarArgs.push("-czf");
    else if (compress === "bz2") tarArgs.push("-cjf");
    else if (compress === "xz") tarArgs.push("-cJf");
    else tarArgs.push("-cf");
    tarArgs.push(fullDest, ...sources);

    const result = await ctx!.exec("tar", tarArgs, { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, sources: sources.length, destination: fullDest, compress },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `backup error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

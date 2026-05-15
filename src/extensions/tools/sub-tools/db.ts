import { Type } from "typebox";

export const dbSchema = Type.Object({
  type: Type.Optional(Type.String({ description: "mysql, postgres, sqlite (default: mysql)" })),
  host: Type.Optional(Type.String()),
  port: Type.Optional(Type.Number()),
  user: Type.Optional(Type.String()),
  password: Type.Optional(Type.String()),
  database: Type.String({ description: "Database name (or file path for sqlite)" }),
  query: Type.String({ description: "SQL query to execute" }),
  timeout: Type.Optional(Type.Number()),
});

export async function executeDb(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { type = "mysql", host, port, user, password, database, query, timeout } = args as {
    type?: string;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database: string;
    query: string;
    timeout?: number;
  };

  try {
    let cmd = "";
    if (type === "mysql") {
      const h = host || "localhost";
      const p = port || 3306;
      const u = user || "";
      const pass = password ? `-p${password}` : "";
      cmd = `mysql -h ${h} -P ${p} -u ${u} ${pass} ${database} -e "${query.replace(/"/g, '\\"')}"`;
    } else if (type === "postgres") {
      const h = host || "localhost";
      const p = port || 5432;
      const u = user ? `-U ${user}` : "";
      cmd = `PGPASSWORD="${password || ""}" psql -h ${h} -p ${p} ${u} ${database} -c "${query.replace(/"/g, '\\"')}"`;
    } else if (type === "sqlite") {
      cmd = `sqlite3 ${database} "${query.replace(/"/g, '\\"')}"`;
    } else {
      return { content: [{ type: "text", text: `Unknown db type: ${type}` }], details: undefined, isError: true } as const;
    }

    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, type },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `DB error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

import { Type } from "typebox";

export const updateSchema = Type.Object({
  manager: Type.Optional(Type.String()),
  packages: Type.Optional(Type.Array(Type.String())),
  dryRun: Type.Optional(Type.Boolean()),
  upgradeAll: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeUpdate(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { manager = "apt", packages = [], dryRun = false, upgradeAll = true, timeout } = args as {
    manager?: string;
    packages?: string[];
    dryRun?: boolean;
    upgradeAll?: boolean;
    timeout?: number;
  };
  try {
    let cmd = "";
    if (manager === "apt" || manager === "all") {
      const aptCmd = dryRun ? "apt list --upgradable 2>/dev/null" : "apt-get upgrade -y";
      cmd = `apt-get update && ${aptCmd}`;
    } else if (manager === "yum") {
      const yumCmd = dryRun ? "yum check-update" : "yum update -y";
      cmd = yumCmd;
    } else if (manager === "npm") {
      if (packages.length > 0) {
        cmd = `npm update ${packages.join(" ")}`;
      } else {
        cmd = dryRun ? "npm outdated" : "npm update -g";
      }
    } else if (manager === "pip") {
      if (packages.length > 0) {
        cmd = `pip install --upgrade ${packages.join(" ")}`;
      } else {
        cmd = dryRun ? "pip list --outdated" : "pip install --upgrade pip setuptools wheel && pip freeze --local | cut -d = -f 1 | xargs -n1 pip install -U";
      }
    } else if (manager === "docker") {
      cmd = dryRun ? "docker images --format '{{.Repository}}:{{.Tag}}' | xargs -r docker pull" : "docker pull $(docker images --format '{{.Repository}}:{{.Tag}}')";
    } else if (manager === "system") {
      cmd = `apt-get update && apt-get upgrade -y && apt-get clean`;
    } else if (manager === "all") {
      cmd = `
        echo '=== APT ===' && apt-get update && apt-get upgrade -y
        echo '=== NPM GLOBAL ===' && npm install -g npm && npm update -g
        echo '=== DOCKER IMAGES ===' && docker images --format '{{.Repository}}:{{.Tag}}' | xargs -r -n1 docker pull
      `;
    } else {
      return { content: [{ type: "text", text: `Unknown manager: ${manager}` }], details: undefined, isError: true } as const;
    }
    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, manager, dryRun, packages: packages.length },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `update error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

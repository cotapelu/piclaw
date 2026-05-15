/**
 * apk sub-tool for Alpine Linux package manager
 */

export const apkSchema = {
	name: "apk",
	description: "Alpine Linux APK package manager operations",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full apk command to execute"
			},
			operation: {
				type: "string",
				description: "Operation: add, del, update, upgrade, search, info, list, fix, cache"
			},
			packages: {
				type: "string",
				description: "Package names (space separated)"
			},
			upgrade: {
				type: "boolean",
				description: "Upgrade all packages"
			},
			available: {
				type: "boolean",
				description: "Show available upgrades"
			},
			search: {
				type: "string",
				description: "Search for package"
			},
			info: {
				type: "string",
				description: "Show package info"
			},
			list: {
				type: "string",
				description: "List: installed, installed_dirs, origin, owned"
			},
			depends: {
				type: "string",
				description: "Show package dependencies"
			},
			belongs: {
				type: "string",
				description: "Find package owning file"
			},
			fix: {
				type: "boolean",
				description: "Fix dependencies"
			},
			cache: {
				type: "boolean",
				description: "Manage cache"
			},
			yes: {
				type: "boolean",
				description: "Assume yes to all"
			},
			verbose: {
				type: "boolean",
				description: "Verbose output"
			},
			version: {
				type: "boolean",
				description: "Show version"
			}
		},
		required: ["command"]
	}
};

export async function executeApk(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, operation, packages, upgrade, available, search, info, list, depends, belongs, fix, cache, yes, verbose, version } = args;
  const timeout = 180000;
  try {
    if (version) {
      const result = await ctx!.exec("apk", ["--version"], { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    if (command) {
      const cmdArgs = command.trim().split(/ \\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const apkArgs: string[] = [];
    if (yes) apkArgs.push("--yes");
    if (verbose) apkArgs.push("--verbose");

    const op = operation || "list";

    const pushPackages = (...prefix: string[]) => {
      if (packages) apkArgs.push(...prefix, ...packages.trim().split(/\\s+/));
    };

    if (op === "add" || op === "install") {
      apkArgs.push("add");
      pushPackages();
    } else if (op === "del" || op === "remove" || op === "rm") {
      apkArgs.push("del");
      pushPackages();
    } else if (op === "update") {
      apkArgs.push("update");
    } else if (op === "upgrade" || op === "up") {
      apkArgs.push("upgrade");
      if (available) apkArgs.push("--available");
      pushPackages();
    } else if (op === "search" || op === "se") {
      apkArgs.push("search");
      const pkg = search || packages;
      if (pkg) apkArgs.push(...pkg.trim().split(/\\s+/));
    } else if (op === "info") {
      apkArgs.push("info");
      const pkg = info || packages;
      if (pkg) apkArgs.push(...pkg.trim().split(/\\s+/));
    } else if (op === "list" || op === "ls") {
      apkArgs.push("list");
      if (list === "installed") apkArgs.push("--installed");
      else if (list === "upgrades") apkArgs.push("--upgrades");
      else if (list === "origin") apkArgs.push("--origin");
      else if (list === "installed-dirs") apkArgs.push("--installed-dirs");
      pushPackages();
    } else if (op === "depends") {
      apkArgs.push("depends");
      const p = depends || packages;
      if (p) apkArgs.push(...p.trim().split(/\\s+/));
    } else if (op === "belongs") {
      apkArgs.push("belongs");
      const p = belongs || packages;
      if (p) apkArgs.push(...p.trim().split(/\\s+/));
    } else if (op === "fix") {
      apkArgs.push("fix");
      pushPackages();
    } else if (op === "cache") {
      apkArgs.push("cache");
      if (cache) apkArgs.push("clean");
    } else if (op === "index") {
      apkArgs.push("index");
    } else if (op === "fetch") {
      apkArgs.push("fetch");
      pushPackages();
    } else if (op === "audit") {
      apkArgs.push("audit");
    } else {
      apkArgs.push(op);
      if (packages) apkArgs.push(...packages.trim().split(/\\s+/));
    }

    const result = await ctx!.exec("apk", apkArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
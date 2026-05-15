/**
 * svn sub-tool for Subversion version control
 */

export const svnSchema = {
	name: "svn",
	description: "Subversion version control operations",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full svn command to execute"
			},
			operation: {
				type: "string",
				description: "Operation: checkout, update, commit, status, diff, log, add, delete, info, list"
			},
			target: {
				type: "string",
				description: "Target file or directory"
			},
			url: {
				type: "string",
				description: "SVN repository URL"
			},
			revision: {
				type: "string",
				description: "Revision number or range"
			},
			message: {
				type: "string",
				description: "Commit message"
			},
			username: {
				type: "string",
				description: "SVN username"
			},
			password: {
				type: "string",
				description: "SVN password"
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

export async function executeSvn(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, operation, target, url, revision, message, username, password, verbose, version } = args;
  const timeout = 60000;
  try {
    if (version) {
      const result = await ctx!.exec("svn", ["--version"], { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    if (command) {
      const cmdArgs = command.trim().split(/ \\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const svnArgs: string[] = [];
    if (username) svnArgs.push("--username", username);
    if (password) svnArgs.push("--password", password);
    if (verbose) svnArgs.push("-v");

    const op = operation || "status";

    const pushOperation = (opName: string) => { svnArgs.push(opName); };
    const pushTarget = (...extra: string[]) => {
      if (target) svnArgs.push(...extra, target);
      else svnArgs.push(...extra, '.');
    };

    if (op === "checkout" || op === "co") {
      pushOperation("checkout");
      if (revision) svnArgs.push("-r", revision);
      svnArgs.push(url || 'REPO_URL');
      pushTarget();
    } else if (op === "update" || op === "up") {
      pushOperation("update");
      if (revision) svnArgs.push("-r", revision);
      pushTarget();
    } else if (op === "commit" || op === "ci") {
      pushOperation("commit");
      if (message) svnArgs.push("-m", message);
      pushTarget();
    } else if (op === "status" || op === "st") {
      pushOperation("status");
      pushTarget();
    } else if (op === "diff") {
      pushOperation("diff");
      if (revision) svnArgs.push("-r", revision);
      pushTarget();
    } else if (op === "log") {
      pushOperation("log");
      if (revision) svnArgs.push("-r", revision);
      pushTarget();
    } else if (op === "add") {
      pushOperation("add");
      pushTarget();
    } else if (op === "delete" || op === "del" || op === "remove") {
      pushOperation("delete");
      pushTarget();
    } else if (op === "info") {
      pushOperation("info");
      pushTarget();
    } else if (op === "list" || op === "ls") {
      pushOperation("list");
      if (url) svnArgs.push(url);
      else pushTarget();
    } else if (op === "revert") {
      pushOperation("revert");
      pushTarget();
    } else {
      svnArgs.push(op);
      if (target) svnArgs.push(target);
    }

    const result = await ctx!.exec("svn", svnArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
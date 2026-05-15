/**
 * hg (Mercurial) sub-tool for Mercurial version control
 */

export const hgSchema = {
	name: "hg",
	description: "Mercurial version control operations",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full hg command to execute"
			},
			operation: {
				type: "string",
				description: "Operation: clone, pull, push, update, status, diff, log, commit, add, remove, branch, heads, tags"
			},
			target: {
				type: "string",
				description: "Target file or directory"
			},
			url: {
				type: "string",
				description: "Repository URL"
			},
			revision: {
				type: "string",
				description: "Revision number or hash"
			},
			message: {
				type: "string",
				description: "Commit message"
			},
			branch: {
				type: "string",
				description: "Branch name"
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

export async function executeHg(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, operation, target, url, revision, message, branch, verbose, version } = args;
  const timeout = 60000;
  try {
    if (version) {
      const result = await ctx!.exec("hg", ["--version"], { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    if (command) {
      const cmdArgs = command.trim().split(/ \\s+/);
      const result = await ctx!.exec(cmdArgs[0], cmdArgs.slice(1), { cwd, signal, timeout });
      return result.stdout || result.stderr;
    }

    const hgArgs: string[] = [];
    if (verbose) hgArgs.push("-v");

    const op = operation || "status";

    const pushTarget = (...extra: string[]) => {
      if (target) hgArgs.push(...extra, target);
      else if (extra.length > 0) hgArgs.push(...extra);
      else hgArgs.push('.');
    };

    if (op === "clone") {
      hgArgs.push("clone");
      if (revision) hgArgs.push("-r", revision);
      hgArgs.push(url || 'REPO_URL');
      pushTarget();
    } else if (op === "pull") {
      hgArgs.push("pull");
      if (url) hgArgs.push(url);
      if (revision) hgArgs.push("-r", revision);
    } else if (op === "push") {
      hgArgs.push("push");
      if (url) hgArgs.push(url);
      if (revision) hgArgs.push("-r", revision);
    } else if (op === "update" || op === "checkout" || op === "co") {
      hgArgs.push("update");
      if (revision) hgArgs.push("-r", revision);
      if (branch) hgArgs.push("-b", branch);
      pushTarget();
    } else if (op === "status" || op === "st") {
      hgArgs.push("status");
      pushTarget();
    } else if (op === "diff") {
      hgArgs.push("diff");
      if (revision) hgArgs.push("-r", revision);
      pushTarget();
    } else if (op === "log") {
      hgArgs.push("log");
      if (revision) hgArgs.push("-r", revision);
      if (branch) hgArgs.push("-b", branch);
      pushTarget();
    } else if (op === "commit" || op === "ci") {
      hgArgs.push("commit");
      if (message) hgArgs.push("-m", message);
      pushTarget();
    } else if (op === "add") {
      hgArgs.push("add");
      pushTarget();
    } else if (op === "remove" || op === "rm") {
      hgArgs.push("remove");
      pushTarget();
    } else if (op === "branch") {
      hgArgs.push("branch");
      if (branch) hgArgs.push(branch);
    } else if (op === "heads") {
      hgArgs.push("heads");
      if (branch) hgArgs.push("-b", branch);
    } else if (op === "tags") {
      hgArgs.push("tags");
    } else if (op === "incoming" || op === "in") {
      hgArgs.push("incoming");
      if (url) hgArgs.push(url);
    } else if (op === "outgoing" || op === "out") {
      hgArgs.push("outgoing");
      if (url) hgArgs.push(url);
    } else if (op === "rollback") {
      hgArgs.push("rollback");
    } else if (op === "revert") {
      hgArgs.push("revert");
      if (revision) hgArgs.push("-r", revision);
      pushTarget();
    } else {
      hgArgs.push(op);
      if (target) hgArgs.push(target);
    }

    const result = await ctx!.exec("hg", hgArgs, { cwd, signal, timeout });
    return result.stdout || result.stderr;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
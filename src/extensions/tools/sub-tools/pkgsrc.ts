/**
 * pkgsrc sub-tool for pkgsrc package manager
 */

export const pkgsrcSchema = {
	name: "pkgsrc",
	description: "pkgsrc package manager operations (BSD systems)",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full pkgsrc command to execute"
			},
			operation: {
				type: "string",
				description: "Operation: install, remove, update, info, search, list, clean"
			},
			packages: {
				type: "string",
				description: "Package names (space separated)"
			},
			category: {
				type: "string",
				description: "Package category"
			},
			all: {
				type: "boolean",
				description: "All packages or categories"
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

export async function executePkgsrc(args: { command?: string; operation?: string; packages?: string; category?: string; all?: boolean; yes?: boolean; verbose?: boolean; version?: boolean }): Promise<string> {
	const { command, operation, packages, category, all, yes, verbose, version } = args;
	
	let cmd = "";
	
	if (version) {
		cmd = "pkg_info --version 2>&1 || echo 'pkgsrc not installed'";
	} else if (command) {
		cmd = command;
	} else if (!operation && !packages && !category) {
		return "Error: Please provide an operation (install, remove, update, etc.) or use --version to see pkgsrc version.";
	} else {
		// Use bmake for pkgsrc
		cmd = "cd /usr/pkgsrc && bmake";
		
		if (yes) cmd += " -D";
		if (verbose) cmd += " -V";
		
		// Add operation
		const op = operation || "category";
		
		if (op === "install") {
			cmd += ` install ${packages || ''}`;
		} else if (op === "remove" || op === "deinstall") {
			cmd += ` deinstall ${packages || ''}`;
		} else if (op === "update" || op === "upgrade") {
			cmd += ` update ${packages || ''}`;
		} else if (op === "clean") {
			cmd += " clean";
			if (all) cmd += " -a";
		} else if (op === "info") {
			cmd += ` info ${packages || ''}`;
		} else if (op === "search") {
			cmd += ` search ${packages || ''}`;
		} else if (op === "list") {
			cmd += " list";
			if (category) cmd += ` CATEGORY=${category}`;
			cmd += ` ${packages || ''}`;
		} else if (op === "category") {
			cmd += " show-var VARNAMES=CATEGORIES";
		} else if (op === "mkpplist") {
			cmd += " mkpplist";
		} else {
			cmd += ` ${op}`;
			if (packages) cmd += ` ${packages}`;
		}
	}
	
	const { exec } = await import("child_process");
	const { promisify } = await import("util");
	const execAsync = promisify(exec);
	
	try {
		const { stdout, stderr } = await execAsync(cmd, { timeout: 300000 });
		return stdout || stderr;
	} catch (error: any) {
		return `Error: ${error.message}`;
	}
}
/**
 * pkg sub-tool for FreeBSD package manager
 */

export const pkgSchema = {
	name: "pkg",
	description: "FreeBSD pkg package manager operations",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full pkg command to execute"
			},
			operation: {
				type: "string",
				description: "Operation: install, remove, update, upgrade, search, info, autoremove, clean"
			},
			packages: {
				type: "string",
				description: "Package names (space separated)"
			},
			all: {
				type: "boolean",
				description: "Update all packages"
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
				type: "boolean",
				description: "List installed packages"
			},
			upgrades: {
				type: "boolean",
				description: "Show available upgrades"
			},
			autoremove: {
				type: "boolean",
				description: "Remove unused packages"
			},
			clean: {
				type: "boolean",
				description: "Clean cache"
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

export async function executePkg(args: { command?: string; operation?: string; packages?: string; all?: boolean; search?: string; info?: string; list?: boolean; upgrades?: boolean; autoremove?: boolean; clean?: boolean; yes?: boolean; verbose?: boolean; version?: boolean }): Promise<string> {
	const { command, operation, packages, all, search, info, list, upgrades, autoremove, clean, yes, verbose, version } = args;
	
	let cmd = "";
	
	if (version) {
		cmd = "pkg --version 2>&1";
	} else if (command) {
		cmd = command;
	} else if (!operation && !packages && !search && !info && !list && !clean) {
		return "Error: Please provide an operation (install, remove, update, etc.) or use --version to see pkg version.";
	} else {
		// Build pkg command
		cmd = "pkg";
		
		if (yes) cmd += " -y";
		if (verbose) cmd += " -v";
		
		// Add operation
		const op = operation || "list";
		
		if (op === "install" || op === "add") {
			cmd += " install";
			cmd += ` ${packages || ''}`;
		} else if (op === "remove" || op === "delete" || op === "rm") {
			cmd += " delete";
			cmd += ` ${packages || ''}`;
		} else if (op === "update") {
			cmd += " update";
		} else if (op === "upgrade" || op === "up") {
			cmd += " upgrade";
			if (all) cmd += " -a";
			cmd += ` ${packages || ''}`;
		} else if (op === "search" || op === "se") {
			cmd += ` search ${search || packages || ''}`;
		} else if (op === "info") {
			cmd += ` info ${info || packages || ''}`;
		} else if (op === "list") {
			cmd += " list";
			cmd += ` ${packages || ''}`;
		} else if (op === "upgrades" || op === "autoremove") {
			cmd += " autoremove";
		} else if (op === "clean") {
			cmd += " clean";
		} else if (op === "version") {
			cmd += " version";
			if (all) cmd += " -a";
		} else if (op === "check") {
			cmd += " check";
			if (upgrades) cmd += " -r";
		} else if (op === "stats") {
			cmd += " stats";
		} else if (op === "which") {
			cmd += ` which ${packages || ''}`;
		} else if (op === "autoremove") {
			cmd += " autoremove";
		} else if (search) {
			cmd += ` search ${search}`;
		} else if (info) {
			cmd += ` info ${info}`;
		} else if (list) {
			cmd += " list";
		} else if (clean) {
			cmd += " clean";
		} else {
			cmd += ` ${op}`;
			if (packages) cmd += ` ${packages}`;
		}
	}
	
	const { exec } = await import("child_process");
	const { promisify } = await import("util");
	const execAsync = promisify(exec);
	
	try {
		const { stdout, stderr } = await execAsync(cmd, { timeout: 180000 });
		return stdout || stderr;
	} catch (error: any) {
		return `Error: ${error.message}`;
	}
}
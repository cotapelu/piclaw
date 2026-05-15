/**
 * pacman sub-tool for Arch Linux package manager
 */

export const pacmanSchema = {
	name: "pacman",
	description: "Arch Linux package manager operations",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full pacman command to execute"
			},
			operation: {
				type: "string",
				description: "Operation: sync, query, install, remove, upgrade, clean, deptest"
			},
			packages: {
				type: "string",
				description: "Package names (space separated)"
			},
			sync: {
				type: "boolean",
				description: "Sync databases"
			},
			sysupgrade: {
				type: "boolean",
				description: "System upgrade"
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
			explicitly_installed: {
				type: "boolean",
				description: "List explicitly installed packages"
			},
			orphans: {
				type: "boolean",
				description: "List orphan packages"
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

export async function executePacman(args: { command?: string; operation?: string; packages?: string; sync?: boolean; sysupgrade?: boolean; search?: string; info?: string; list?: boolean; explicitly_installed?: boolean; orphans?: boolean; clean?: boolean; yes?: boolean; verbose?: boolean; version?: boolean }): Promise<string> {
	const { command, operation, packages, sync, sysupgrade, search, info, list, explicitly_installed, orphans, clean, yes, verbose, version } = args;
	
	let cmd = "";
	
	if (version) {
		cmd = "pacman --version 2>&1";
	} else if (command) {
		cmd = command;
	} else if (!operation && !packages && !sync && !sysupgrade && !search && !info && !list && !clean) {
		return "Error: Please provide an operation (sync, install, remove, etc.) or use --version to see pacman version.";
	} else {
		// Build pacman command
		cmd = "pacman";
		
		if (yes || operation === "remove") cmd += " --noconfirm";
		if (verbose) cmd += " -v";
		
		// Add operation
		const op = operation || (sync ? "sync" : "query");
		
		if (op === "sync" || op === "Sy") {
			cmd += " -S";
			if (sysupgrade) cmd += "u";
			if (search) cmd += "s";
			cmd += ` ${packages || ''}`;
		} else if (op === "query" || op === "Qs") {
			cmd += " -Q";
			if (search) cmd += "s";
			if (info) cmd += "i";
			if (explicitly_installed) cmd += "e";
			if (orphans) cmd += "t";
			cmd += ` ${packages || ''}`;
		} else if (op === "install" || op === "S") {
			cmd += " -S";
			if (sysupgrade) cmd += "yu";
			cmd += ` ${packages || ''}`;
		} else if (op === "remove" || op === "R") {
			cmd += " -R";
			if (yes) cmd += "s";  // remove dependencies
			cmd += ` ${packages || ''}`;
		} else if (op === "upgrade" || op === "U") {
			cmd += " -U";
			cmd += ` ${packages || ''}`;
		} else if (op === "clean" || op === "Sc") {
			cmd += " -Sc";
		} else if (op === "deptest") {
			cmd += " -D --check";
		} else if (op === "list") {
			cmd += " -Q";
			cmd += ` ${packages || ''}`;
		} else if (search) {
			cmd += " -Ss";
			cmd += ` ${search}`;
		} else if (info) {
			cmd += " -Qi";
			cmd += ` ${info}`;
		} else if (list) {
			cmd += " -Q";
			if (explicitly_installed) cmd += "qe";
			cmd += ` ${packages || ''}`;
		} else if (clean) {
			cmd += " -Sc";
		} else {
			cmd += ` ${op}`;
			if (packages) cmd += ` ${packages}`;
		}
	}
	
	const { exec } = await import("child_process");
	const { promisify } = await import("util");
	const execAsync = promisify(exec);
	
	try {
		const { stdout, stderr } = await execAsync(cmd, { timeout: 120000 });
		return stdout || stderr;
	} catch (error: any) {
		return `Error: ${error.message}`;
	}
}
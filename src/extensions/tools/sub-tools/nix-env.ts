/**
 * nix-env sub-tool for Nix package manager
 */

export const nixEnvSchema = {
	name: "nix-env",
	description: "Nix package manager operations",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full nix-env command to execute"
			},
			operation: {
				type: "string",
				description: "Operation: install, remove, upgrade, query, profile, switch-generation, rollback"
			},
			packages: {
				type: "string",
				description: "Package names (space separated)"
			},
			attr: {
				type: "string",
				description: "Attribute path"
			},
			all: {
				type: "boolean",
				description: "Upgrade all packages"
			},
			profile: {
				type: "string",
				description: "Profile path"
			},
			search: {
				type: "string",
				description: "Search for package"
			},
			query: {
				type: "string",
				description: "Query: installed, available"
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

export async function executeNixEnv(args: { command?: string; operation?: string; packages?: string; attr?: string; all?: boolean; profile?: string; search?: string; query?: string; verbose?: boolean; version?: boolean }): Promise<string> {
	const { command, operation, packages, attr, all, profile, search, query, verbose, version } = args;
	
	let cmd = "";
	
	if (version) {
		cmd = "nix-env --version 2>&1";
	} else if (command) {
		cmd = command;
	} else if (!operation && !packages && !search && !query) {
		return "Error: Please provide an operation (install, remove, upgrade, etc.) or use --version to see nix-env version.";
	} else {
		// Build nix-env command
		cmd = "nix-env";
		
		if (profile) cmd += ` --profile ${profile}`;
		if (verbose) cmd += " -v";
		
		// Add operation
		const op = operation || "query";
		
		if (op === "install" || op === "i") {
			cmd += " -iA";
			if (attr) cmd += ` ${attr}`;
			else cmd += ` ${packages || ''}`;
		} else if (op === "remove" || op === "rm" || op === "uninstall") {
			cmd += " -e";
			cmd += ` ${packages || ''}`;
		} else if (op === "upgrade" || op === "u") {
			cmd += " -u";
			if (all) cmd += " -A";
			cmd += ` ${packages || ''}`;
		} else if (op === "query" || op === "q") {
			cmd += " -q";
			if (query === "installed") cmd += "";
			else if (query === "available") cmd += " -a";
			cmd += ` ${packages || ''}`;
		} else if (op === "switch-generation" || op === "switch") {
			cmd += ` --switch-generation ${packages || ''}`;
		} else if (op === "rollback") {
			cmd += " --rollback";
		} else if (op === "list-generations") {
			cmd += " --list-generations";
		} else if (op === "delete-generations") {
			cmd += " --delete-generations";
			cmd += ` ${packages || ''}`;
		} else if (search) {
			cmd += ` -qaP ${search}`;
		} else if (packages) {
			cmd += ` ${op} ${packages}`;
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
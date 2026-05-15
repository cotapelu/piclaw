/**
 * guix sub-tool for GNU Guix package manager
 */

export const guixSchema = {
	name: "guix",
	description: "GNU Guix package manager operations",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full guix command to execute"
			},
			operation: {
				type: "string",
				description: "Operation: install, remove, upgrade, search, package, gc, pull, weather"
			},
			packages: {
				type: "string",
				description: "Package names (space separated)"
			},
			all: {
				type: "boolean",
				description: "All packages or generations"
			},
			manifest: {
				type: "string",
				description: "Manifest file"
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
				description: "List: installed, available, generations"
			},
			generations: {
				type: "string",
				description: "Manage generations"
			},
			profile: {
				type: "string",
				description: "Profile path"
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

export async function executeGuix(args: { command?: string; operation?: string; packages?: string; all?: boolean; manifest?: string; search?: string; info?: string; list?: string; generations?: string; profile?: string; verbose?: boolean; version?: boolean }): Promise<string> {
	const { command, operation, packages, all, manifest, search, info, list, generations, profile, verbose, version } = args;
	
	let cmd = "";
	
	if (version) {
		cmd = "guix --version 2>&1 | head -3";
	} else if (command) {
		cmd = command;
	} else if (!operation && !packages && !search && !info && !list && !generations) {
		return "Error: Please provide an operation (install, remove, upgrade, etc.) or use --version to see guix version.";
	} else {
		// Build guix command
		cmd = "guix";
		
		if (profile) cmd += ` --profile=${profile}`;
		if (verbose) cmd += " -v";
		
		// Add operation
		const op = operation || "list";
		
		if (op === "install") {
			cmd += " package -i";
			if (manifest) cmd += ` --manifest=${manifest}`;
			cmd += ` ${packages || ''}`;
		} else if (op === "remove" || op === "uninstall") {
			cmd += " package -r";
			cmd += ` ${packages || ''}`;
		} else if (op === "upgrade") {
			cmd += " package -u";
			if (all) cmd += " -A";
			cmd += ` ${packages || ''}`;
		} else if (op === "search") {
			cmd += ` search ${search || packages || ''}`;
		} else if (op === "info") {
			cmd += ` package -i ${info || packages || ''}`;
		} else if (op === "list" || op === "packages") {
			cmd += " package --list";
			if (list === "installed") cmd += "";
			else if (list === "available") cmd += " -A";
		} else if (op === "gc") {
			cmd += " gc";
			if (all) cmd += " --delete-generations";
		} else if (op === "pull") {
			cmd += " pull";
		} else if (op === "weather") {
			cmd += " weather";
		} else if (op === "describe") {
			cmd += " describe";
		} else if (op === " generations" || op === " generations") {
			cmd += ` package -- generations=${generations || 'list'}`;
		} else if (search) {
			cmd += ` search ${search}`;
		} else if (info) {
			cmd += ` package -i ${info}`;
		} else if (list) {
			cmd += ` package -- list ${list}`;
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
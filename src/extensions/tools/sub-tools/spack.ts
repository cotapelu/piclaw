/**
 * spack sub-tool for Spack HPC package manager
 */

export const spackSchema = {
	name: "spack",
	description: "Spack HPC package manager operations",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full spack command to execute"
			},
			operation: {
				type: "string",
				description: "Operation: install, remove, find, spec, info, list, compilers, mirror, mirror create"
			},
			packages: {
				type: "string",
				description: "Package names (space separated)"
			},
			spec: {
				type: "string",
				description: "Package spec"
			},
			all: {
				type: "boolean",
				description: "All packages or compilers"
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

export async function executeSpack(args: { command?: string; operation?: string; packages?: string; spec?: string; all?: boolean; verbose?: boolean; version?: boolean }): Promise<string> {
	const { command, operation, packages, spec, all, verbose, version } = args;
	
	let cmd = "";
	
	if (version) {
		cmd = "spack --version 2>&1 || echo 'Spack not installed'";
	} else if (command) {
		cmd = command;
	} else if (!operation && !packages && !spec) {
		return "Error: Please provide an operation (install, remove, find, etc.) or use --version to see spack version.";
	} else {
		// Build spack command
		cmd = "spack";
		
		if (verbose) cmd += " -v";
		
		// Add operation
		const op = operation || "find";
		
		if (op === "install" || op === "spec") {
			cmd += " install";
			if (spec) cmd += ` ${spec}`;
			else cmd += ` ${packages || ''}`;
		} else if (op === "remove" || op === "uninstall") {
			cmd += " uninstall";
			cmd += ` ${packages || ''}`;
		} else if (op === "find" || op === "list" || op === "ls") {
			cmd += " find";
			if (all) cmd += " -a";
			cmd += ` ${packages || ''}`;
		} else if (op === "spec") {
			cmd += ` spec ${spec || packages || ''}`;
		} else if (op === "info") {
			cmd += ` info ${packages || ''}`;
		} else if (op === "versions") {
			cmd += ` versions ${packages || ''}`;
		} else if (op === "location") {
			cmd += ` location ${packages || ''}`;
		} else if (op === "compilers") {
			cmd += " compilers";
			if (all) cmd += " --all";
		} else if (op === "mirror") {
			cmd += " mirror";
		} else if (op === "mirror-create") {
			cmd += " mirror create";
		} else if (op === "config") {
			cmd += " config";
		} else if (op === "env") {
			cmd += " env";
		} else if (op === "stage") {
			cmd += ` stage ${packages || ''}`;
		} else if (op === "build") {
			cmd += ` build ${packages || ''}`;
		} else if (op === "test") {
			cmd += " test";
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
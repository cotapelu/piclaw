/**
 * Julia language sub-tool for executing Julia scripts and managing Julia packages
 */

export const juliaSchema = {
	name: "julia",
	description: "Execute Julia commands, scripts, or manage Julia packages",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The Julia command or expression to execute"
			},
			script: {
				type: "string",
				description: "Path to a Julia script file to execute"
			},
			expression: {
				type: "string",
				description: "Julia expression to evaluate (e.g., 'println(\"hello\")')"
			},
			packages: {
				type: "string",
				description: "Julia package(s) to add (space-separated)"
			},
			add_package: {
				type: "string",
				description: "Julia package to add (alias for packages)"
			},
			remove_package: {
				type: "string",
				description: "Julia package to remove"
			},
			update_packages: {
				type: "boolean",
				description: "Update all installed Julia packages"
			},
			list_packages: {
				type: "boolean",
				description: "List installed Julia packages"
			},
			test_package: {
				type: "string",
				description: "Run tests for a specific package"
			},
			version: {
				type: "boolean",
				description: "Show Julia version information"
			}
		},
		required: ["command"]
	}
};

export async function executeJulia(args: { command?: string; script?: string; expression?: string; packages?: string; add_package?: string; remove_package?: string; update_packages?: boolean; list_packages?: boolean; test_package?: string; version?: boolean }): Promise<string> {
	const { command, script, expression, packages, add_package, remove_package, update_packages, list_packages, test_package, version } = args;
	
	let cmd = "";
	
	if (version) {
		cmd = "julia --version";
	} else if (list_packages) {
		cmd = "julia -e 'using Pkg; println.(keys(Pkg.dependencies()))'";
	} else if (update_packages) {
		cmd = "julia -e 'using Pkg; Pkg.update()'";
	} else if (script) {
		cmd = `julia ${script}`;
	} else if (expression) {
		cmd = `julia -e '${expression}'`;
	} else if (test_package) {
		cmd = `julia -e 'using Pkg; Pkg.test("${test_package}")'`;
	} else if (packages || add_package) {
		const pkg = packages || add_package;
		cmd = `julia -e 'using Pkg; Pkg.add("${pkg}")'`;
	} else if (remove_package) {
		cmd = `julia -e 'using Pkg; Pkg.rm("${remove_package}")'`;
	} else if (command) {
		cmd = `julia -e '${command}'`;
	} else {
		return "Error: Please provide a valid command. Use version, list_packages, update_packages, script, expression, packages, remove_package, or test_package.";
	}
	
	const { exec } = await import("child_process");
	const { promisify } = await import("util");
	const execAsync = promisify(exec);
	
	try {
		const { stdout, stderr } = await execAsync(cmd, { timeout: 60000 });
		return stdout || stderr;
	} catch (error: any) {
		return `Error: ${error.message}`;
	}
}
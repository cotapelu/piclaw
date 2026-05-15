/**
 * R language sub-tool for executing R scripts and R commands
 */

export const rSchema = {
	name: "r",
	description: "Execute R commands, scripts, or manage R packages",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The R command or expression to execute"
			},
			script: {
				type: "string",
				description: "Path to an R script file to execute"
			},
			expression: {
				type: "string",
				description: "R expression to evaluate (e.g., 'print(\"hello\")')"
			},
			packages: {
				type: "string",
				description: "R package(s) to install from CRAN"
			},
			install_packages: {
				type: "string",
				description: "R packages to install (alias for packages)"
			},
			remove_packages: {
				type: "string",
				description: "R packages to remove"
			},
			list_packages: {
				type: "boolean",
				description: "List installed R packages"
			},
			update_packages: {
				type: "boolean",
				description: "Update all installed R packages"
			},
			version: {
				type: "boolean",
				description: "Show R version information"
			},
			libraries: {
				type: "string",
				description: "Comma-separated list of libraries to load before running command"
			}
		},
		required: ["command"]
	}
};

export async function executeR(args: { command?: string; script?: string; expression?: string; packages?: string; install_packages?: string; remove_packages?: string; list_packages?: boolean; update_packages?: boolean; version?: boolean; libraries?: string }): Promise<string> {
	const { command, script, expression, packages, install_packages, remove_packages, list_packages, update_packages, version, libraries } = args;
	
	let cmd = "";
	
	if (version) {
		cmd = "R --version";
	} else if (list_packages) {
		cmd = "R -e \"rownames(installed.packages())\"";
	} else if (update_packages) {
		cmd = "R -e \"update.packages(ask = FALSE)\"";
	} else if (script) {
		cmd = `Rscript ${script}`;
	} else if (expression) {
		cmd = `R -e '${expression}'`;
	} else if (packages || install_packages) {
		const pkgs = packages || install_packages;
		cmd = `R -e "install.packages(c('${(pkgs || '').split(' ').join("','")}'))"`;
	} else if (remove_packages) {
		cmd = `R -e "remove.packages(c('${remove_packages.split(' ').join("','")}'))"`;
	} else if (command) {
		let fullCmd = `R -e '${command}'`;
		if (libraries) {
			const libs = libraries.split(',').map((l: string) => l.trim()).join(', ');
			fullCmd = `R -e 'library(${libs}); ${command}'`;
		}
		cmd = fullCmd;
	} else {
		return "Error: Please provide a valid command. Use version, list_packages, update_packages, script, expression, packages, or remove_packages.";
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
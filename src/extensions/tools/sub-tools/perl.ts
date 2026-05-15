/**
 * Perl sub-tool for executing Perl commands and CPAN operations
 */

export const perlSchema = {
	name: "perl",
	description: "Execute Perl commands or CPAN module operations",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The Perl command to execute. Use command for full commands, or cpan/module/script/run options"
			},
			cpan: {
				type: "boolean",
				description: "Whether to use CPAN (cpanm) for module operations"
			},
			module: {
				type: "string",
				description: "CPAN module name to install (when cpan is true)"
			},
			script: {
				type: "string",
				description: "Path to a Perl script file to execute"
			},
			run: {
				type: "string",
				description: "Perl one-liner or expression to run"
			},
			version: {
				type: "boolean",
				description: "Show Perl version information"
			},
			list_modules: {
				type: "boolean",
				description: "List installed CPAN modules"
			}
		},
		required: ["command"]
	}
};

export async function executePerl(args: { command?: string; cpan?: boolean; module?: string; script?: string; run?: string; version?: boolean; list_modules?: boolean }): Promise<string> {
	const { command, cpan, module, script, run, version, list_modules } = args;
	
	let cmd = "";
	
	if (version) {
		cmd = "perl -v";
	} else if (list_modules) {
		cmd = "perl -e 'use ExtUtils::Installed; my $inst = ExtUtils::Installed->new(); print \"$_\n\" for $inst->modules;'";
	} else if (cpan && module) {
		cmd = `cpanm ${module}`;
	} else if (script) {
		cmd = `perl ${script}`;
	} else if (run) {
		cmd = `perl -e '${run}'`;
	} else if (command) {
		cmd = command;
	} else {
		return "Error: Please provide either command, version, list_modules, or use cpan/module/script/run options.";
	}
	
	const { exec } = await import("child_process");
	const { promisify } = await import("util");
	const execAsync = promisify(exec);
	
	try {
		const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
		return stdout || stderr;
	} catch (error: any) {
		return `Error: ${error.message}`;
	}
}
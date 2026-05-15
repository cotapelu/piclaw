/**
 * Whois and DNS lookup sub-tool for domain and IP information
 */

export const whoisSchema = {
	name: "whois",
	description: "Query domain registration and DNS information using whois and host commands",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full whois/host command to execute"
			},
			domain: {
				type: "string",
				description: "Domain name to look up"
			},
			ip: {
				type: "string",
				description: "IP address to look up"
			},
			type: {
				type: "string",
				description: "DNS record type (A, AAAA, MX, TXT, NS, CNAME, etc.)"
			},
			reverse: {
				type: "boolean",
				description: "Perform reverse DNS lookup"
			},
			nameserver: {
				type: "string",
				description: "Specific nameserver to query"
			},
			verbose: {
				type: "boolean",
				description: "Verbose output"
			},
			version: {
				type: "boolean",
				description: "Show whois/version info"
			}
		},
		required: ["command"]
	}
};

export async function executeWhois(args: { command?: string; domain?: string; ip?: string; type?: string; reverse?: boolean; nameserver?: string; verbose?: boolean; version?: boolean }): Promise<string> {
	const { command, domain, ip, type, reverse, nameserver, verbose, version } = args;
	
	let cmd = "";
	
	if (version) {
		cmd = "whois --version 2>&1 | head -2; host -v 2>&1 | head -3";
	} else if (command) {
		cmd = command;
	} else if (domain) {
		// Domain whois lookup
		cmd = `whois ${domain}`;
	} else if (ip) {
		// IP whois lookup
		cmd = `whois ${ip}`;
	} else if (type && (domain || ip)) {
		// DNS lookup using host command
		const target = domain || ip;
		cmd = `host ${type === 'PTR' ? '-t PTR' : '-t'} ${type} ${target}`;
		if (nameserver) {
			cmd += ` ${nameserver}`;
		}
		if (verbose) {
			cmd = `host -v ${type} ${target}`;
			if (nameserver) {
				cmd += ` ${nameserver}`;
			}
		}
	} else if (reverse && ip) {
		// Reverse DNS lookup
		cmd = `host ${ip}`;
	} else if (domain) {
		// Default to A record lookup
		cmd = `host ${domain}`;
	} else {
		return "Error: Please provide domain or IP to look up. Use type for specific DNS record types (A, MX, TXT, NS, etc.). Use --version to see versions.";
	}
	
	const { exec } = await import("child_process");
	const { promisify } = await import("util");
	const execAsync = promisify(exec);
	
	try {
		const { stdout, stderr } = await execAsync(cmd, { timeout: 15000 });
		return stdout || stderr;
	} catch (error: any) {
		return `Error: ${error.message}`;
	}
}
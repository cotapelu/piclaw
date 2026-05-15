/**
 * SSH Keygen sub-tool for SSH key generation and management
 */

export const sshKeygenSchema = {
	name: "ssh-keygen",
	description: "Generate, manage, and convert SSH keys",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full ssh-keygen command to execute"
			},
			generate: {
				type: "boolean",
				description: "Generate a new SSH key pair"
			},
			key_type: {
				type: "string",
				description: "Key type (rsa, ed25519, ecdsa, dsa)"
			},
			bits: {
				type: "number",
				description: "Number of bits for RSA keys (e.g., 4096)"
			},
			output: {
				type: "string",
				description: "Output file path for the key (default: ~/.ssh/id_type)"
			},
			comment: {
				type: "string",
				description: "Comment to add to the key"
			},
			password: {
				type: "string",
				description: "Passphrase for the key (empty for no passphrase)"
			},
			list: {
				type: "boolean",
				description: "List all known hosts"
			},
			fingerprint: {
				type: "string",
				description: "Show fingerprint of a key file"
			},
			convert: {
				type: "string",
				description: "Convert key format (e.g., 'pem' to 'openssh')"
			},
			version: {
				type: "boolean",
				description: "Show ssh-keygen version"
			}
		},
		required: ["command"]
	}
};

export async function executeSshKeygen(args: { command?: string; generate?: boolean; key_type?: string; bits?: number; output?: string; comment?: string; password?: string; list?: boolean; fingerprint?: string; convert?: string; version?: boolean }): Promise<string> {
	const { command, generate, key_type, bits, output, comment, password, list, fingerprint, convert, version } = args;
	
	let cmd = "ssh-keygen";
	
	if (version) {
		cmd = "ssh-keygen -V";
	} else if (list) {
		cmd = "ssh-keygen -l -f ~/.ssh/known_hosts 2>/dev/null || echo 'No known_hosts file'";
	} else if (fingerprint) {
		cmd = `ssh-keygen -lf ${fingerprint}`;
	} else if (generate) {
		const type = key_type || "ed25519";
		const outputFile = output || `~/.ssh/id_${type}`;
		
		cmd = `ssh-keygen -t ${type}`;
		if (bits && type === "rsa") {
			cmd += ` -b ${bits}`;
		}
		cmd += ` -f ${outputFile}`;
		if (comment) {
			cmd += ` -C "${comment}"`;
		}
		if (password !== undefined) {
			if (password === "") {
				cmd += " -N ''";
			} else if (password) {
				cmd += ` -N "${password}"`;
			}
		} else {
			cmd += " -N ''";
		}
	} else if (command) {
		cmd = command;
	} else {
		return "Error: Please provide a valid action. Use generate, list, fingerprint, or a full command. Use --version to see ssh-keygen version.";
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
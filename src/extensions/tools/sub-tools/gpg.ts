/**
 * GPG (GNU Privacy Guard) sub-tool for encryption and decryption
 */

export const gpgSchema = {
	name: "gpg",
	description: "Encrypt, decrypt, sign, and verify files using GPG",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full gpg command to execute"
			},
			encrypt: {
				type: "boolean",
				description: "Encrypt a file"
			},
			decrypt: {
				type: "boolean",
				description: "Decrypt a file"
			},
			file: {
				type: "string",
				description: "File to encrypt/decrypt/sign/verify"
			},
			recipient: {
				type: "string",
				description: "Recipient's public key for encryption"
			},
			output: {
				type: "string",
				description: "Output file path"
			},
			sign: {
				type: "boolean",
				description: "Sign a file"
			},
			sign_key: {
				type: "string",
				description: "Key ID to use for signing"
			},
			verify: {
				type: "boolean",
				description: "Verify a signature"
			},
			keygen: {
				type: "boolean",
				description: "Generate a new GPG key pair"
			},
			list_keys: {
				type: "boolean",
				description: "List all GPG keys"
			},
			list_public: {
				type: "boolean",
				description: "List public keys"
			},
			list_secret: {
				type: "boolean",
				description: "List secret keys"
			},
			import_key: {
				type: "string",
				description: "Import a key from file"
			},
			export_key: {
				type: "string",
				description: "Export a public key (provide key ID)"
			},
			version: {
				type: "boolean",
				description: "Show GPG version"
			}
		},
		required: ["command"]
	}
};

export async function executeGpg(args: { command?: string; encrypt?: boolean; decrypt?: boolean; file?: string; recipient?: string; output?: string; sign?: boolean; sign_key?: string; verify?: boolean; keygen?: boolean; list_keys?: boolean; list_public?: boolean; list_secret?: boolean; import_key?: string; export_key?: string; version?: boolean }): Promise<string> {
	const { command, encrypt, decrypt, file, recipient, output, sign, sign_key, verify, keygen, list_keys, list_public, list_secret, import_key, export_key, version } = args;
	
	let cmd = "gpg";
	
	if (version) {
		cmd = "gpg --version";
	} else if (list_keys || list_public) {
		cmd = "gpg --list-keys";
	} else if (list_secret) {
		cmd = "gpg --list-secret-keys";
	} else if (keygen) {
		cmd = "gpg --full-generate-key";
	} else if (import_key) {
		cmd = `gpg --import ${import_key}`;
	} else if (export_key) {
		cmd = `gpg --armor --export ${export_key}`;
	} else if (encrypt && file) {
		cmd = `gpg --encrypt`;
		if (recipient) {
			cmd += ` --recipient ${recipient}`;
		}
		if (output) {
			cmd += ` --output ${output}`;
		}
		cmd += ` ${file}`;
	} else if (decrypt && file) {
		cmd = `gpg --decrypt`;
		if (output) {
			cmd += ` --output ${output}`;
		}
		cmd += ` ${file}`;
	} else if (sign && file) {
		cmd = `gpg --sign`;
		if (sign_key) {
			cmd += ` --local-user ${sign_key}`;
		}
		if (output) {
			cmd += ` --output ${output}`;
		}
		cmd += ` ${file}`;
	} else if (verify && file) {
		cmd = `gpg --verify ${file}`;
	} else if (command) {
		cmd = command;
	} else {
		return "Error: Please provide a valid action (encrypt, decrypt, sign, verify, keygen, list_keys, import_key, export_key) or a full command. Use --version to see GPG version.";
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
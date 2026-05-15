/**
 * HTTP Benchmark tools (ab, wrk, bombardier) sub-tool
 */

export const benchmarkSchema = {
	name: "benchmark",
	description: "HTTP benchmarking using ApacheBench (ab), wrk, or bombardier",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full benchmark command to execute"
			},
			tool: {
				type: "string",
				description: "Which tool: 'ab', 'wrk', or 'bombardier'"
			},
			url: {
				type: "string",
				description: "Target URL to benchmark"
			},
			requests: {
				type: "number",
				description: "Total number of requests to make"
			},
			concurrency: {
				type: "number",
				description: "Number of concurrent requests"
			},
			duration: {
				type: "number",
				description: "Duration in seconds (for wrk/bombardier)"
			},
			threads: {
				type: "number",
				description: "Number of threads (for wrk/bombardier)"
			},
			method: {
				type: "string",
				description: "HTTP method (GET, POST, etc.)"
			},
			headers: {
				type: "string",
				description: "Custom headers"
			},
			body: {
				type: "string",
				description: "Request body for POST"
			},
			version: {
				type: "boolean",
				description: "Show benchmark tool version"
			}
		},
		required: ["command"]
	}
};

export async function executeBenchmark(args: { command?: string; tool?: string; url?: string; requests?: number; concurrency?: number; duration?: number; threads?: number; method?: string; headers?: string; body?: string; version?: boolean }): Promise<string> {
	const { command, tool, url, requests, concurrency, duration, threads, method, headers, body, version } = args;
	
	let cmd = "";
	
	if (version) {
		cmd = "echo '=== ApacheBench (ab) ===' && ab -V 2>&1 | head -3; echo '=== wrk ===' && wrk --version 2>&1 || echo 'wrk not found'; echo '=== bombardier ===' && bombardier --version 2>&1 || echo 'bombardier not found'";
	} else if (command) {
		cmd = command;
	} else if (!url) {
		return "Error: Please provide a URL to benchmark";
	} else if (!tool || tool === "ab") {
		// ApacheBench (ab)
		cmd = "ab";
		cmd += ` -n ${requests || 1000}`;
		cmd += ` -c ${concurrency || 10}`;
		if (method) cmd += ` -m ${method}`;
		if (headers) {
			const headerParts = headers.split(',');
			for (const h of headerParts) {
				cmd += ` -H '${h.trim()}'`;
			}
		}
		if (body) cmd += ` -p -`;  // will read from stdin
		cmd += ` ${url}`;
	} else if (tool === "wrk") {
		// wrk
		cmd = "wrk";
		cmd += ` -t ${threads || 4}`;
		cmd += ` -c ${concurrency || 100}`;
		if (duration) cmd += ` -d ${duration}s`;
		else cmd += ` -d 10s`;  // default 10 seconds
		if (method) cmd += ` -m ${method}`;
		if (headers) cmd += ` -H '${headers}'`;
		if (body) cmd += ` -d '${body}'`;
		cmd += ` ${url}`;
	} else if (tool === "bombardier") {
		// bombardier
		cmd = "bombardier";
		cmd += ` -n ${requests || 10000}`;
		cmd += ` -c ${concurrency || 100}`;
		if (duration) cmd += ` -d ${duration}s`;
		if (method) cmd += ` -m ${method}`;
		if (headers) cmd += ` -H '${headers}'`;
		if (body) cmd += ` -b '${body}'`;
		cmd += ` ${url}`;
	} else {
		return "Error: Unknown tool. Use 'ab', 'wrk', or 'bombardier'";
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
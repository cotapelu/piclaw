import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { VERSION as PI_VERSION } from "@mariozechner/pi-coding-agent";

// Default values (fallback)
let PICLAW_APP_NAME = "piclaw";
let PICLAW_VERSION = "0.0.1";

// Try to read piclaw package.json from various locations
const possiblePaths = [
    join(process.cwd(), "package.json"),
    join(process.cwd(), "..", "package.json"),
    join(__dirname, "..", "..", "package.json"), // dist/extensions -> dist -> root
    join(__dirname, "..", "..", "..", "package.json"), // src/extensions -> src -> root
    join(__dirname, "..", "..", "..", "..", "package.json"),
];

for (const path of possiblePaths) {
    try {
        if (existsSync(path)) {
            const content = readFileSync(path, "utf-8");
            const pkg = JSON.parse(content);
            if (pkg.name) PICLAW_APP_NAME = pkg.name;
            if (pkg.version) PICLAW_VERSION = pkg.version;
            break;
        }
    } catch {
        // ignore
    }
}

export default function (api: ExtensionAPI): void {
	api.on("session_start", async (_event, ctx) => {
		if (ctx.hasUI) {
			ctx.ui.setHeader((_tui, theme) => {
				const line1 = theme.fg("dim", `${PICLAW_APP_NAME} agent build on top of pi.dev sdk.`);
				const line2 = theme.bold(theme.fg("accent", PICLAW_APP_NAME)) + theme.fg("dim", ` v${PICLAW_VERSION}`);
				return new Text(`${line1}\n${line2}`, 1, 0);
			});
		}
	});


}

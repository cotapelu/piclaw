/**
 * Render functions for sub-tools
 */

import { Text } from "@mariozechner/pi-tui";

/**
 * Theme interface for type safety
 */
interface Theme {
  fg(name: string, text: string): string;
  bold(text: string): string;
}

/**
 * Default renderCall for sub-tools
 */
export function createRenderCall(name: string) {
  return (args: any, theme: Theme, _context: any) => {
    const th = theme;
    const { args: toolArgs } = args as { subtool: string; args: any };
    let text = th.fg("toolTitle", th.bold(`${name} `));
    if (toolArgs && typeof toolArgs === "object") {
      const keys = Object.keys(toolArgs);
      if (keys.length > 0) {
        const firstKey = keys[0];
        const value = toolArgs[firstKey];
        if (typeof value === "string") {
          const preview = value.substring(0, 30);
          const ellipsis = value.length > 30 ? "..." : "";
          text += th.fg("dim", `"${preview}${ellipsis}"`);
        }
      }
    }
    return new Text(text, 0, 0);
  };
}

/**
 * Default renderResult for sub-tools
 */
export function createRenderResult() {
  return (result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, _context: any) => {
    const th = theme;
    if (options.isPartial) {
      return new Text(th.fg("warning", "Processing..."), 0, 0);
    }
    const content = result.content?.[0]?.text || "";
    if (result.isError) {
      return new Text(th.fg("error", content), 0, 0);
    }
    return new Text(th.fg("success", content), 0, 0);
  };
}

/**
 * Render call for subtool_loader main tool
 */
export function renderSubtoolLoaderCall(args: any, theme: Theme, _context: any) {
  const th = theme;
  const { subtool, args: toolArgs } = args as { subtool: string; args: any };
  let text = th.fg("toolTitle", th.bold(`subtool_loader `)) + th.fg("muted", subtool);
  if (toolArgs && typeof toolArgs === "object") {
    const keys = Object.keys(toolArgs);
    if (keys.length > 0) {
      const firstKey = keys[0];
      const value = toolArgs[firstKey];
      if (typeof value === "string") {
        const preview = value.substring(0, 30);
        const ellipsis = value.length > 30 ? "..." : "";
        const argPreview = `"${preview}${ellipsis}"`;
        text += ` ${th.fg("dim", argPreview)}`;
      }
    }
  }
  return new Text(text, 0, 0);
}

/**
 * Render result for subtool_loader main tool
 */
export function renderSubtoolLoaderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, _context: any) {
  const th = theme;
  if (options.isPartial) {
    return new Text(th.fg("warning", "Processing..."), 0, 0);
  }
  const content = result.content?.[0]?.text || "";
  if (result.isError) {
    return new Text(th.fg("error", content), 0, 0);
  }
  return new Text(th.fg("success", content), 0, 0);
}
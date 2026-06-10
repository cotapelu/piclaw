import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock all dependencies (no external references to avoid hoisting issues)
vi.mock("../extensions/providers/kilo-provider", () => ({
  registerKiloProvider: vi.fn(),
}));
vi.mock("../extensions/tools/index.js", () => ({
  registerTodosTool: vi.fn(),
  registerMemoryTool: vi.fn(),
  registerUniversalTool: vi.fn(),
}));
vi.mock("../extensions/tools/git-tool.js", () => ({ registerGitTool: vi.fn() }));
vi.mock("../extensions/tools/test-tool.js", () => ({ registerTestTool: vi.fn() }));
vi.mock("../extensions/tools/formatter-tool.js", () => ({ registerFormatterTool: vi.fn() }));
vi.mock("../extensions/tools/audit-tool.js", () => ({ registerAuditTool: vi.fn() }));
vi.mock("../extensions/tools/build-tool.js", () => ({ registerBuildTool: vi.fn() }));
vi.mock("../extensions/tools/metrics-tool.js", () => ({ registerMetricsTool: vi.fn() }));
vi.mock("../extensions/tools/secret-scanner-tool.js", () => ({ registerSecretScannerTool: vi.fn() }));
vi.mock("../extensions/tools/scripts-tool.js", () => ({ registerScriptsTool: vi.fn() }));
vi.mock("../extensions/team/index.js", () => ({ registerTeamTool: vi.fn() }));
vi.mock("../extensions/tools/subtool-loader.js", () => ({ registerSubToolLoaderExtension: vi.fn() }));
vi.mock("../extensions/tools/tool-template.js", () => ({ registerToolTemplate: vi.fn() }));
vi.mock("../extensions/tools/skill-reader.js", () => ({ registerSkillReaderExtension: vi.fn() }));
vi.mock("../extensions/hooks/auto-continue.js", () => ({ default: vi.fn() }));
vi.mock("../extensions/hooks/auto-compact-85.js", () => ({ default: vi.fn() }));
vi.mock("../extensions/piclaw-header.js", () => ({ default: vi.fn() }));
vi.mock("../extensions/renderers/todos-renderer.js", () => ({ registerTodosRenderer: vi.fn() }));
vi.mock("../extensions/team/team-widget.js", () => ({ registerTeamWidget: vi.fn() }));
vi.mock("../extensions/renderers/memory-renderer.js", () => ({ registerMemoryRenderer: vi.fn() }));
vi.mock("../extensions/renderers/branch-summary-renderer.js", () => ({ registerBranchSummaryRenderer: vi.fn() }));
vi.mock("../extensions/renderers/team-ops-renderer.js", () => ({ registerTeamOpsRenderer: vi.fn() }));
vi.mock("../extensions/commands/session-tree-command.js", () => ({ registerSessionTreeCommand: vi.fn() }));
vi.mock("../extensions/commands/settings-command.js", () => ({ registerSettingsCommand: vi.fn() }));
vi.mock("../extensions/commands/provider-command.js", () => ({ registerProviderCommand: vi.fn() }));
vi.mock("../extensions/commands/copy-command.js", () => ({ registerCopyCommand: vi.fn() }));
vi.mock("../extensions/commands/team-command.js", () => ({ registerTeamCommand: vi.fn() }));

// Now import the module under test and the mocked functions
import { extensionsAggregator, getExtensionFactories } from "../extensions/factory";
import { registerKiloProvider } from "../extensions/providers/kilo-provider";
import { registerTodosTool, registerMemoryTool, registerUniversalTool } from "../extensions/tools/index";
import { registerGitTool } from "../extensions/tools/git-tool";
import { registerTestTool } from "../extensions/tools/test-tool";
import { registerFormatterTool } from "../extensions/tools/formatter-tool";
import { registerAuditTool } from "../extensions/tools/audit-tool";
import { registerBuildTool } from "../extensions/tools/build-tool";
import { registerMetricsTool } from "../extensions/tools/metrics-tool";
import { registerSecretScannerTool } from "../extensions/tools/secret-scanner-tool";
import { registerTeamTool } from "../extensions/team/index";
import { registerSubToolLoaderExtension } from "../extensions/tools/subtool-loader";
import { registerToolTemplate } from "../extensions/tools/tool-template";
import { registerSkillReaderExtension } from "../extensions/tools/skill-reader";
import autoContinueExtension from "../extensions/hooks/auto-continue";
import autoCompact85Extension from "../extensions/hooks/auto-compact-85";
import piclawHeader from "../extensions/piclaw-header";
import { registerTodosRenderer } from "../extensions/renderers/todos-renderer";
import { registerTeamWidget } from "../extensions/team/team-widget";
import { registerMemoryRenderer } from "../extensions/renderers/memory-renderer";
import { registerBranchSummaryRenderer } from "../extensions/renderers/branch-summary-renderer";
import { registerTeamOpsRenderer } from "../extensions/renderers/team-ops-renderer";
import { registerSessionTreeCommand } from "../extensions/commands/session-tree-command";
import { registerSettingsCommand } from "../extensions/commands/settings-command";
import { registerProviderCommand } from "../extensions/commands/provider-command";
import { registerCopyCommand } from "../extensions/commands/copy-command";
import { registerTeamCommand } from "../extensions/commands/team-command";
import { registerScriptsTool } from "../extensions/tools/scripts-tool";

describe("Extensions Aggregator", () => {
  const mockApi: any = { registerTool: vi.fn(), on: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers all extensions and hooks", () => {
    extensionsAggregator(mockApi);

    expect(registerKiloProvider).toHaveBeenCalledWith(mockApi);
    expect(registerTodosTool).toHaveBeenCalledWith(mockApi);
    expect(registerMemoryTool).toHaveBeenCalledWith(mockApi);
    expect(registerUniversalTool).toHaveBeenCalledWith(mockApi);
    expect(registerGitTool).toHaveBeenCalledWith(mockApi);
    expect(registerTestTool).toHaveBeenCalledWith(mockApi);
    expect(registerFormatterTool).toHaveBeenCalledWith(mockApi);
    expect(registerAuditTool).toHaveBeenCalledWith(mockApi);
    expect(registerBuildTool).toHaveBeenCalledWith(mockApi);
    expect(registerMetricsTool).toHaveBeenCalledWith(mockApi);
    expect(registerSecretScannerTool).toHaveBeenCalledWith(mockApi);
    expect(registerScriptsTool).toHaveBeenCalledWith(mockApi);
    expect(registerTeamTool).toHaveBeenCalledWith(mockApi);
    expect(registerSubToolLoaderExtension).toHaveBeenCalledWith(mockApi);
    expect(registerToolTemplate).toHaveBeenCalledWith(mockApi);
    expect(registerSkillReaderExtension).toHaveBeenCalledWith(mockApi);
    expect(autoContinueExtension).toHaveBeenCalledWith(mockApi);
    expect(autoCompact85Extension).toHaveBeenCalledWith(mockApi);
    expect(piclawHeader).toHaveBeenCalledWith(mockApi);
    expect(registerTodosRenderer).toHaveBeenCalledWith(mockApi);
    expect(registerTeamWidget).toHaveBeenCalledWith(mockApi);
    expect(registerMemoryRenderer).toHaveBeenCalledWith(mockApi);
    expect(registerBranchSummaryRenderer).toHaveBeenCalledWith(mockApi);
    expect(registerTeamOpsRenderer).toHaveBeenCalledWith(mockApi);
    expect(registerSessionTreeCommand).toHaveBeenCalledWith(mockApi);
    expect(registerSettingsCommand).toHaveBeenCalledWith(mockApi);
    expect(registerProviderCommand).toHaveBeenCalledWith(mockApi);
    expect(registerCopyCommand).toHaveBeenCalledWith(mockApi);
    expect(registerTeamCommand).toHaveBeenCalledWith(mockApi);
  });

  it("getExtensionFactories returns array containing aggregator", () => {
    const factories = getExtensionFactories();
    expect(Array.isArray(factories)).toBe(true);
    expect(factories).toContain(extensionsAggregator);
  });
});

/**
 * Team System - Exports (Minimal)
 *
 * Simplified team collaboration with basic task distribution and shared workspace.
 * For detailed team creation and execution, see team-manager.ts.
 */

// Core classes
export { AgentTeam, type AgentTeamRuntime } from "./team-manager.js";
export { SharedWorkspace, type WorkspaceEntry } from "./workspace.js";

// Boot functions
export { bootPiclawTeam, executeTeamTasks } from "./team-manager.js";

// Re-exports
export type { PiclawCoreOptions } from "../piclaw-core.js";

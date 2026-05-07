/**
 * Team System - Exports
 */

// Core classes
export { AgentTeam, type AgentTeamRuntime } from "./team-manager.js";
export { SharedWorkspace, type WorkspaceEntry } from "./workspace.js";
export { TeamContextManager } from "./team-context.js";
export { TeamMessageBus, type TeamMessage, CHANNELS } from "./message-bus.js";
export { DynamicTaskManager } from "./dynamic-task-manager.js";
export { ConflictResolutionManager, CollaborativeWorkspace } from "./conflict-resolution.js";

// Boot functions
export { bootPiclawTeam, executeTeamTasks } from "./team-manager.js";

// Re-exports from other modules (if needed)
export type { PiclawCoreOptions } from "../piclaw-core.js";

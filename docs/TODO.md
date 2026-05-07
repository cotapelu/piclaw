# Piclaw Development TODO

## Completed ✅

### Team System v2 (Non-blocking Event-Driven)
- [x] Design non-blocking team architecture (create → background run → events)
- [x] Implement TeamContext for shared state
- [x] Implement MessageBus for inter-agent communication
- [x] Implement ConflictResolution with locking and versioning
- [x] Implement DynamicTaskManager for work stealing
- [x] Unify `spawn_team` tool with multiple actions (create, status, send, dispose, list)
- [x] Add event emission: team_created, team_progress, team_completed, team_disposed
- [x] Remove blocking wait — fully non-blocking
- [x] Update prompt guidelines with full workflow examples
- [x] Build and test (build successful)

## In Progress 🚧

### Testing & Integration
- [ ] Write unit tests for TeamContext
- [ ] Write unit tests for MessageBus
- [ ] Write unit tests for ConflictResolutionManager
- [ ] Write unit tests for DynamicTaskManager
- [ ] Integration test: full team workflow
- [ ] Test event system (team_created, team_completed events reach parent)
- [ ] Manual testing: spawn_team in TUI with real API

### Documentation
- [ ] Create TEAM.md with usage examples and architecture diagram
- [ ] Add troubleshooting section (common issues: lock conflicts, agents stuck)
- [ ] Document event API (team_created, team_progress, team_completed)
- [ ] Add examples: multi-team management, dynamic guidance

### Improvements
- [ ] Optional parent participation (coordinator role)
- [ ] Add progress throttling (reduce team_progress event frequency)
- [ ] Implement team-level timeout/abort
- [ ] Add team metrics (messages sent, conflicts occurred, work stolen)
- [ ] Consider adding merge strategies for common artifact types (JSON, arrays)
- [ ] Add team-level error handling (what if one agent crashes?)

## Next Priorities

1. **Testing** - Ensure team system works reliably
2. **Documentation** - Write TEAM.md for users
3. **Manual Demo** - Run real team with API keys to validate behavior
4. **Polish** - Fix any bugs discovered during testing
5. **Push to Remote** - After validation, push feature branch

## Notes

- Team system is fully functional but needs thorough testing
- Events are emitted via parentRuntime.emit() — parent must subscribe
- Workspace locking works but needs real-world validation
- Bootstrap prompt teaches collaboration but LLM compliance needs testing

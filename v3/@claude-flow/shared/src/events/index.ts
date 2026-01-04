/**
 * Event Sourcing System (ADR-007)
 *
 * Complete event sourcing implementation for V3 Claude Flow:
 * - Domain events for all aggregates (agent, task, memory, swarm)
 * - Persistent event store with SQLite backend
 * - Projections for building read models
 * - Event replay and snapshots
 *
 * @module v3/shared/events
 */

// Domain Events
export {
  DomainEvent,
  AllDomainEvents,
  AgentSpawnedEvent,
  AgentStartedEvent,
  AgentStoppedEvent,
  AgentFailedEvent,
  AgentStatusChangedEvent,
  AgentTaskAssignedEvent,
  AgentTaskCompletedEvent,
  TaskCreatedEvent,
  TaskStartedEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  TaskBlockedEvent,
  TaskQueuedEvent,
  MemoryStoredEvent,
  MemoryRetrievedEvent,
  MemoryDeletedEvent,
  MemoryExpiredEvent,
  SwarmInitializedEvent,
  SwarmScaledEvent,
  SwarmTerminatedEvent,
  SwarmPhaseChangedEvent,
  SwarmMilestoneReachedEvent,
  SwarmErrorEvent,
  createAgentSpawnedEvent,
  createAgentStartedEvent,
  createAgentStoppedEvent,
  createAgentFailedEvent,
  createTaskCreatedEvent,
  createTaskStartedEvent,
  createTaskCompletedEvent,
  createTaskFailedEvent,
  createMemoryStoredEvent,
  createMemoryRetrievedEvent,
  createMemoryDeletedEvent,
  createSwarmInitializedEvent,
  createSwarmScaledEvent,
  createSwarmTerminatedEvent,
} from './domain-events.js';

// Event Store
export {
  EventStore,
  EventStoreConfig,
  EventFilter,
  EventSnapshot,
  EventStoreStats,
} from './event-store.js';

// Projections
export {
  Projection,
  AgentStateProjection,
  AgentProjectionState,
  TaskHistoryProjection,
  TaskProjectionState,
  MemoryIndexProjection,
  MemoryProjectionState,
} from './projections.js';

// State Reconstruction (ADR-007)
export {
  StateReconstructor,
  createStateReconstructor,
  AgentAggregate,
  TaskAggregate,
  type AggregateRoot,
  type ReconstructorOptions,
} from './state-reconstructor.js';

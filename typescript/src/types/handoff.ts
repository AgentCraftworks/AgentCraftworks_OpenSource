/**
 * Handoff domain types
 * Unified handoff system types for the TypeScript implementation
 *
 * 4-state Finite State Machine:
 *   pending → active → completed
 *     ↓        ↓
 *   failed   failed
 *
 * The "failed" state uses reason prefixes for diagnostics:
 *   rejected:*, abandoned:*, error:*, timeout:*
 */

/** Valid handoff states in the 4-state Finite State Machine */
export type HandoffState = "pending" | "active" | "completed" | "failed";

/** Priority levels for handoff triage */
export type Priority = "low" | "medium" | "high" | "critical";

/** Core handoff record */
export interface Handoff {
  readonly handoff_id: string;
  issue_number: number | null;
  repository_full_name: string;
  from_agent: string | null;
  to_agent: string | null;
  status: HandoffState;
  task: string;
  context: string;
  priority: Priority;
  sla: number | string | null;
  sla_hours: number | null;
  sla_deadline: string | null;
  completed_work: readonly string[];
  blockers: readonly string[];
  outputs: Record<string, unknown>;
  dependencies: readonly string[];
  failure_reason: string | null;
  initiating_comment_id: string | null;
  created_at: string;
  updated_at: string;
  acknowledged_at: string | null;
  in_progress_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  /** Tracker-specific fields */
  teams: readonly string[];
  tier: string | null;
  metadata: Record<string, unknown>;
  /** Audit trail fields */
  worktree_id: string | null;
  worktree_path: string | null;
  session_id: string | null;
}

/** Input for creating a new handoff */
export interface CreateHandoffInput {
  to?: string;
  to_agent?: string;
  task: string;
  context?: string;
  priority?: Priority;
  completed_work?: readonly string[];
  blockers?: readonly string[];
  outputs?: Record<string, unknown>;
  dependencies?: readonly string[];
  sla?: number | string;
}

/** Metadata passed alongside handoff creation */
export interface HandoffMetadata {
  issue_number?: number;
  repository_full_name?: string;
  from_agent?: string;
  sla_hours?: number;
  sla_deadline?: string;
  comment_id?: string;
  /** Tracker-style aliases */
  prNumber?: number;
  repo?: string;
  slaHours?: number;
  teams?: readonly string[];
  tier?: string;
  additional?: Record<string, unknown>;
}

/** State change audit record */
export interface StateChange {
  readonly change_id: string;
  readonly handoff_id: string;
  from_state: HandoffState;
  to_state: HandoffState;
  reason: string;
  triggered_by: string;
  comment_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Transition options when changing handoff state */
export interface TransitionOptions {
  reason?: string;
  triggeredBy?: string;
  metadata?: Record<string, unknown>;
  commentId?: string;
}

/** Result of a state transition */
export interface TransitionResult {
  handoff: Handoff;
  stateChange: StateChange;
}

/** Handoff statistics */
export interface HandoffStats {
  total: number;
  byStatus: Partial<Record<HandoffState, number>>;
  byPriority: Partial<Record<string, number>>;
  avgCompletionTime: number | null;
  slaComplianceRate: number;
}

/** Filter options for listing handoffs */
export interface HandoffFilters {
  status?: HandoffState;
  to_agent?: string;
  from_agent?: string;
  repository_full_name?: string;
  /** Tracker-style aliases */
  state?: string;
  repo?: string;
}

/** Valid state transitions in the 4-state Finite State Machine */
export const VALID_TRANSITIONS: Record<HandoffState, readonly HandoffState[]> = {
  pending: ["active", "failed"],
  active: ["completed", "failed"],
  completed: [],
  failed: [],
} as const;

/** Terminal states that cannot be transitioned from */
export const TERMINAL_STATES: readonly HandoffState[] = [
  "completed",
  "failed",
] as const;

/** Agent session record for audit trail */
export interface AgentSession {
  readonly sessionId: string;
  handoffId: string;
  agentId: string;
  repository: string;
  prNumber: number | null;
  worktreePath: string | null;
  startedAt: string;
  completedAt: string | null;
  tokenUsage: TokenUsage;
  toolCalls: ToolCallStats;
  commits: readonly string[];
  filesChanged: readonly string[];
  linesAdded: number;
  linesRemoved: number;
  status: "active" | "completed" | "failed";
}

/** Token usage tracking */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

/** Tool call statistics */
export interface ToolCallStats {
  total: number;
  byType: Record<string, number>;
}

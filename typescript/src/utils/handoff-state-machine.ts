/**
 * Handoff State Machine
 * Validates state transitions for the 4-state Finite State Machine.
 *
 * State diagram:
 *   pending → active → completed
 *     ↓        ↓
 *   failed   failed
 *
 * The "failed" state uses reason prefixes for diagnostics:
 *   rejected:*, abandoned:*, error:*, timeout:*
 */

import type { HandoffState } from "../types/handoff.js";
import { VALID_TRANSITIONS, TERMINAL_STATES } from "../types/handoff.js";

/**
 * Canonical handoff state constants.
 * Re-exported so callers do not need to hard-code string literals.
 */
export const HandoffStates = {
  PENDING: "pending" as const,
  ACTIVE: "active" as const,
  COMPLETED: "completed" as const,
  FAILED: "failed" as const,
} as const;

/**
 * Standard reasons / triggers for state transitions.
 * These are free-form strings; the constants below are common values.
 */
export const TransitionReasons = {
  AGENT_ACCEPTED: "agent_accepted",
  WORK_COMPLETED: "work_completed",
  SYSTEM_ERROR: "error:system",
  SLA_BREACH: "timeout:sla_breach",
  MANUAL_OVERRIDE: "manual_override",
  ABANDONED: "abandoned:unknown",
} as const;

/** Check if a state transition is valid */
export function isValidTransition(
  fromState: HandoffState,
  toState: HandoffState
): boolean {
  const allowed = VALID_TRANSITIONS[fromState];
  return allowed.includes(toState);
}

/** Check if a state is terminal (no further transitions allowed) */
export function isTerminalState(state: HandoffState): boolean {
  return TERMINAL_STATES.includes(state);
}

/** Get all valid next states from a given state */
export function getNextStates(state: HandoffState): readonly HandoffState[] {
  return VALID_TRANSITIONS[state];
}

/** Alias for getNextStates (matches JS reference API) */
export const getAllowedNextStates = getNextStates;

/** Validate a transition and throw if invalid */
export function validateTransition(
  fromState: HandoffState,
  toState: HandoffState
): void {
  if (isTerminalState(fromState)) {
    throw new Error(
      `Invalid state transition: ${fromState} is a terminal state, cannot transition to ${toState}`
    );
  }

  if (!isValidTransition(fromState, toState)) {
    const allowed = VALID_TRANSITIONS[fromState].join(", ");
    throw new Error(
      `Invalid state transition: ${fromState} → ${toState}. ` +
        `Allowed transitions from ${fromState}: [${allowed}]`
    );
  }
}

/** Timestamp field to set for each state */
export function getTimestampField(
  state: HandoffState
): string | null {
  const map: Partial<Record<HandoffState, string>> = {
    pending: "acknowledged_at",
    active: "in_progress_at",
    completed: "completed_at",
  };
  return map[state] ?? null;
}

/** Map old 6-state names to new 4-state names */
export function mapLegacyState(legacyState: string): HandoffState {
  const mapping: Record<string, HandoffState> = {
    initiated: "pending",
    accepted: "active",
    rejected: "failed",
    created: "pending",
    abandoned: "failed",
    overdue: "pending", // overdue is computed, not stored
  };
  return (mapping[legacyState] ?? legacyState) as HandoffState;
}

/** Default transition reasons for each state */
export function getDefaultReason(toState: HandoffState): string {
  const reasons: Record<HandoffState, string> = {
    pending: "created",
    active: "agent_accepted",
    completed: "work_completed",
    failed: "error:unknown",
  };
  return reasons[toState];
}

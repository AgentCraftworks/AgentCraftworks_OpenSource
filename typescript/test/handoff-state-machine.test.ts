/**
 * Handoff State Machine — Tests for 4-state FSM
 *
 * Tests covering:
 *   - All valid transitions (pending→active, pending→failed, active→completed, active→failed)
 *   - All invalid transitions
 *   - Terminal state behavior
 *   - Helper functions
 *   - Legacy state mapping
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HandoffStates,
  TransitionReasons,
  isValidTransition,
  isTerminalState,
  getNextStates,
  getAllowedNextStates,
  validateTransition,
  getTimestampField,
  mapLegacyState,
  getDefaultReason,
} from "../src/utils/handoff-state-machine.js";

// ─── Valid Transitions ─────────────────────────────────────────────────────────────

describe("isValidTransition — valid paths", () => {
  it("pending -> active is valid", () => {
    assert.equal(isValidTransition("pending", "active"), true);
  });

  it("pending -> failed is valid", () => {
    assert.equal(isValidTransition("pending", "failed"), true);
  });

  it("active -> completed is valid", () => {
    assert.equal(isValidTransition("active", "completed"), true);
  });

  it("active -> failed is valid", () => {
    assert.equal(isValidTransition("active", "failed"), true);
  });
});

// ─── Invalid Transitions ───────────────────────────────────────────────────────────

describe("isValidTransition — invalid paths", () => {
  it("pending -> completed is invalid (must go through active)", () => {
    assert.equal(isValidTransition("pending", "completed"), false);
  });

  it("active -> pending is invalid (no backward transition)", () => {
    assert.equal(isValidTransition("active", "pending"), false);
  });

  it("completed -> anything is invalid (terminal)", () => {
    assert.equal(isValidTransition("completed", "pending"), false);
    assert.equal(isValidTransition("completed", "active"), false);
    assert.equal(isValidTransition("completed", "failed"), false);
  });

  it("failed -> anything is invalid (terminal)", () => {
    assert.equal(isValidTransition("failed", "pending"), false);
    assert.equal(isValidTransition("failed", "active"), false);
    assert.equal(isValidTransition("failed", "completed"), false);
  });

  it("self-transitions are invalid", () => {
    assert.equal(isValidTransition("pending", "pending"), false);
    assert.equal(isValidTransition("active", "active"), false);
  });
});

// ─── Terminal States ─────────────────────────────────────────────────────────────

describe("isTerminalState", () => {
  it("completed is terminal", () => {
    assert.equal(isTerminalState("completed"), true);
  });

  it("failed is terminal", () => {
    assert.equal(isTerminalState("failed"), true);
  });

  it("pending is NOT terminal", () => {
    assert.equal(isTerminalState("pending"), false);
  });

  it("active is NOT terminal", () => {
    assert.equal(isTerminalState("active"), false);
  });
});

// ─── getNextStates / getAllowedNextStates ───────────────────────────────────────

describe("getNextStates", () => {
  it("pending can go to active or failed", () => {
    const next = getNextStates("pending");
    assert.deepEqual([...next], ["active", "failed"]);
  });

  it("active can go to completed or failed", () => {
    const next = getNextStates("active");
    assert.deepEqual([...next], ["completed", "failed"]);
  });

  it("completed has no next states", () => {
    const next = getNextStates("completed");
    assert.equal(next.length, 0);
  });

  it("failed has no next states", () => {
    const next = getNextStates("failed");
    assert.equal(next.length, 0);
  });

  it("getAllowedNextStates is an alias of getNextStates", () => {
    assert.equal(getAllowedNextStates, getNextStates);
  });
});

// ─── validateTransition ────────────────────────────────────────────────────────────

describe("validateTransition", () => {
  it("should not throw for valid transition", () => {
    assert.doesNotThrow(() => validateTransition("pending", "active"));
  });

  it("should throw for invalid transition from non-terminal", () => {
    assert.throws(
      () => validateTransition("pending", "completed"),
      /Invalid state transition.*Allowed transitions/,
    );
  });

  it("should throw for transition from terminal state", () => {
    assert.throws(
      () => validateTransition("completed", "pending"),
      /terminal state/,
    );
  });

  it("should throw for transition from failed state", () => {
    assert.throws(
      () => validateTransition("failed", "pending"),
      /terminal state/,
    );
  });
});

// ─── getTimestampField ─────────────────────────────────────────────────────────────

describe("getTimestampField", () => {
  it("pending maps to acknowledged_at", () => {
    assert.equal(getTimestampField("pending"), "acknowledged_at");
  });

  it("active maps to in_progress_at", () => {
    assert.equal(getTimestampField("active"), "in_progress_at");
  });

  it("completed maps to completed_at", () => {
    assert.equal(getTimestampField("completed"), "completed_at");
  });

  it("failed returns null (no special timestamp)", () => {
    assert.equal(getTimestampField("failed"), null);
  });
});

// ─── mapLegacyState ───────────────────────────────────────────────────────────────

describe("mapLegacyState", () => {
  it("initiated maps to pending", () => {
    assert.equal(mapLegacyState("initiated"), "pending");
  });

  it("created maps to pending", () => {
    assert.equal(mapLegacyState("created"), "pending");
  });

  it("accepted maps to active", () => {
    assert.equal(mapLegacyState("accepted"), "active");
  });

  it("rejected maps to failed", () => {
    assert.equal(mapLegacyState("rejected"), "failed");
  });

  it("abandoned maps to failed", () => {
    assert.equal(mapLegacyState("abandoned"), "failed");
  });

  it("overdue maps to pending (computed, not stored)", () => {
    assert.equal(mapLegacyState("overdue"), "pending");
  });

  it("completed passes through unchanged", () => {
    assert.equal(mapLegacyState("completed"), "completed");
  });

  it("unknown states pass through unchanged", () => {
    assert.equal(mapLegacyState("unknown_state"), "unknown_state");
  });
});

// ─── getDefaultReason ──────────────────────────────────────────────────────────────

describe("getDefaultReason", () => {
  it("pending default reason is created", () => {
    assert.equal(getDefaultReason("pending"), "created");
  });

  it("active default reason is agent_accepted", () => {
    assert.equal(getDefaultReason("active"), "agent_accepted");
  });

  it("completed default reason is work_completed", () => {
    assert.equal(getDefaultReason("completed"), "work_completed");
  });

  it("failed default reason is error:unknown", () => {
    assert.equal(getDefaultReason("failed"), "error:unknown");
  });
});

// ─── Constants ───────────────────────────────────────────────────────────────────

describe("HandoffStates constants", () => {
  it("should have all 4 states", () => {
    const states = Object.values(HandoffStates);
    assert.equal(states.length, 4);
    assert.ok(states.includes("pending"));
    assert.ok(states.includes("active"));
    assert.ok(states.includes("completed"));
    assert.ok(states.includes("failed"));
  });
});

describe("TransitionReasons constants", () => {
  it("should have standard reasons", () => {
    assert.ok(TransitionReasons.AGENT_ACCEPTED);
    assert.ok(TransitionReasons.WORK_COMPLETED);
    assert.ok(TransitionReasons.SYSTEM_ERROR);
    assert.ok(TransitionReasons.SLA_BREACH);
    assert.ok(TransitionReasons.MANUAL_OVERRIDE);
    assert.ok(TransitionReasons.ABANDONED);
  });

  it("should use reason prefixes for error/timeout categories", () => {
    assert.ok(TransitionReasons.SYSTEM_ERROR.startsWith("error:"));
    assert.ok(TransitionReasons.SLA_BREACH.startsWith("timeout:"));
    assert.ok(TransitionReasons.ABANDONED.startsWith("abandoned:"));
  });
});

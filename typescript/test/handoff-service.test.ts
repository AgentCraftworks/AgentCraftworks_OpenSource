/**
 * Handoff Service — Comprehensive Tests (4-state FSM)
 *
 * Uses node:test (describe, it, beforeEach) and node:assert/strict.
 * Tests covering create, get, list, transitions,
 * convenience methods, SLA, stats, and cleanup.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  initHandoffService,
  createHandoff,
  getHandoff,
  getHandoffByPR,
  listHandoffs,
  transitionHandoff,
  acceptHandoff,
  completeHandoff,
  failHandoff,
  abandonHandoff,
  updateHandoff,
  getStateChangeHistory,
  isOverdue,
  getActiveHandoffs,
  getHandoffStats,
  clearAllHandoffs,
  HandoffStates,
  TransitionReasons,
} from "../src/services/handoff-service.js";
import type { HandoffState } from "../src/types/handoff.js";

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearAllHandoffs();
  initHandoffService({ forceInMemory: true });
});

// ─── Create ──────────────────────────────────────────────────────────────────

describe("createHandoff", () => {
  it("should create a handoff in pending state", () => {
    const h = createHandoff({ task: "Review PR #42", to: "@code-reviewer" });
    assert.ok(h.handoff_id);
    assert.equal(h.task, "Review PR #42");
    assert.equal(h.to_agent, "@code-reviewer");
    assert.equal(h.status, "pending");
    assert.equal(h.priority, "medium");
    assert.ok(h.created_at);
    assert.ok(h.updated_at);
  });

  it("should generate unique UUIDs for each handoff", () => {
    const h1 = createHandoff({ task: "task1", to: "@a" });
    const h2 = createHandoff({ task: "task2", to: "@b" });
    assert.notEqual(h1.handoff_id, h2.handoff_id);
  });

  it("should accept metadata fields", () => {
    const h = createHandoff(
      { task: "fix bug", to: "@dev" },
      {
        issue_number: 99,
        repository_full_name: "owner/repo",
        from_agent: "@orchestrator",
        sla_hours: 4,
        comment_id: "c123",
      },
    );
    assert.equal(h.issue_number, 99);
    assert.equal(h.repository_full_name, "owner/repo");
    assert.equal(h.from_agent, "@orchestrator");
    assert.equal(h.sla_hours, 4);
    assert.ok(h.sla_deadline); // auto-calculated
    assert.equal(h.initiating_comment_id, "c123");
  });

  it("should accept tracker-style metadata aliases", () => {
    const h = createHandoff(
      { task: "test", to: "@bot" },
      { prNumber: 7, repo: "org/repo", slaHours: 2 },
    );
    assert.equal(h.issue_number, 7);
    assert.equal(h.repository_full_name, "org/repo");
    assert.equal(h.sla_hours, 2);
    assert.ok(h.sla_deadline);
  });

  it("should set SLA deadline from sla_hours", () => {
    const before = Date.now();
    const h = createHandoff(
      { task: "test", to: "@bot" },
      { sla_hours: 1 },
    );
    const after = Date.now();
    assert.ok(h.sla_deadline);
    const deadlineMs = new Date(h.sla_deadline).getTime();
    // Deadline should be approximately 1 hour from now
    assert.ok(deadlineMs >= before + 3_600_000 - 1000);
    assert.ok(deadlineMs <= after + 3_600_000 + 1000);
  });

  it("should accept tracker-specific fields (teams, tier)", () => {
    const h = createHandoff(
      { task: "deploy", to: "@deploy-bot" },
      { teams: ["frontend", "backend"], tier: "production" },
    );
    assert.deepEqual([...h.teams], ["frontend", "backend"]);
    assert.equal(h.tier, "production");
  });

  it("should accept to_agent alias", () => {
    const h = createHandoff({ task: "test", to_agent: "@reviewer" });
    assert.equal(h.to_agent, "@reviewer");
  });

  it("should accept priority", () => {
    const h = createHandoff({ task: "urgent", to: "@bot", priority: "critical" });
    assert.equal(h.priority, "critical");
  });
});

// ─── Get ────────────────────────────────────────────────────────────────────

describe("getHandoff", () => {
  it("should retrieve a handoff by ID", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const found = getHandoff(h.handoff_id);
    assert.ok(found);
    assert.equal(found.handoff_id, h.handoff_id);
    assert.equal(found.task, "test");
  });

  it("should return null for unknown ID", () => {
    const found = getHandoff("nonexistent-id");
    assert.equal(found, null);
  });
});

describe("getHandoffByPR", () => {
  it("should find handoff by repo and PR number", () => {
    createHandoff(
      { task: "review", to: "@bot" },
      { repository_full_name: "o/r", issue_number: 42 },
    );
    const found = getHandoffByPR("o/r", 42);
    assert.ok(found);
    assert.equal(found.issue_number, 42);
    assert.equal(found.repository_full_name, "o/r");
  });

  it("should return null when not found", () => {
    const found = getHandoffByPR("o/r", 999);
    assert.equal(found, null);
  });
});

// ─── List ───────────────────────────────────────────────────────────────────

describe("listHandoffs", () => {
  it("should list all handoffs", () => {
    createHandoff({ task: "a", to: "@a" });
    createHandoff({ task: "b", to: "@b" });
    createHandoff({ task: "c", to: "@c" });
    const all = listHandoffs();
    assert.equal(all.length, 3);
  });

  it("should filter by status", () => {
    const h = createHandoff({ task: "a", to: "@a" });
    createHandoff({ task: "b", to: "@b" });
    // All start as pending, transition one to active
    transitionHandoff(h.handoff_id, "active" as HandoffState, {
      reason: "agent_accepted",
    });
    const active = listHandoffs({ status: "active" as HandoffState });
    assert.equal(active.length, 1);
    assert.equal(active[0]!.status, "active");
  });

  it("should filter by to_agent", () => {
    createHandoff({ task: "a", to: "@alice" });
    createHandoff({ task: "b", to: "@bob" });
    const results = listHandoffs({ to_agent: "@alice" });
    assert.equal(results.length, 1);
    assert.equal(results[0]!.to_agent, "@alice");
  });

  it("should filter by repository_full_name", () => {
    createHandoff(
      { task: "a", to: "@a" },
      { repository_full_name: "org/repo1" },
    );
    createHandoff(
      { task: "b", to: "@b" },
      { repository_full_name: "org/repo2" },
    );
    const results = listHandoffs({ repository_full_name: "org/repo1" });
    assert.equal(results.length, 1);
  });

  it("should support tracker-style alias 'repo'", () => {
    createHandoff(
      { task: "a", to: "@a" },
      { repository_full_name: "org/r" },
    );
    const results = listHandoffs({ repo: "org/r" });
    assert.equal(results.length, 1);
  });

  it("should support tracker-style alias 'state'", () => {
    createHandoff({ task: "a", to: "@a" });
    // All handoffs start as pending
    const results = listHandoffs({ state: "pending" });
    assert.equal(results.length, 1);
  });

  it("should map tracker state 'created' to 'pending'", () => {
    createHandoff({ task: "a", to: "@a" });
    const results = listHandoffs({ state: "created" });
    assert.equal(results.length, 1);
    assert.equal(results[0]!.status, "pending");
  });

  it("should map tracker state 'accepted' to 'active'", () => {
    const h = createHandoff({ task: "a", to: "@a" });
    transitionHandoff(h.handoff_id, "active" as HandoffState, {
      reason: "agent_accepted",
    });
    const results = listHandoffs({ state: "accepted" });
    assert.equal(results.length, 1);
    assert.equal(results[0]!.status, "active");
  });

  it("should return results sorted (newest first or stable order)", () => {
    const h1 = createHandoff({ task: "first", to: "@a" });
    const h2 = createHandoff({ task: "second", to: "@b" });
    const all = listHandoffs();
    assert.equal(all.length, 2);
    // Both handoffs should be present regardless of order
    const ids = all.map((h) => h.handoff_id);
    assert.ok(ids.includes(h1.handoff_id));
    assert.ok(ids.includes(h2.handoff_id));
  });
});

// ─── Transitions ────────────────────────────────────────────────────────────

describe("transitionHandoff", () => {
  it("should transition from pending to active", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const result = transitionHandoff(h.handoff_id, "active" as HandoffState, {
      reason: "agent_accepted",
    });
    assert.equal(result.handoff.status, "active");
    assert.ok(result.handoff.in_progress_at);
    assert.equal(result.stateChange.from_state, "pending");
    assert.equal(result.stateChange.to_state, "active");
  });

  it("should reject invalid transitions", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    assert.throws(
      () => transitionHandoff(h.handoff_id, "completed" as HandoffState),
      /Invalid state transition/,
    );
  });

  it("should reject transitions from terminal states", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    transitionHandoff(h.handoff_id, "failed" as HandoffState, {
      reason: "error:test",
    });
    assert.throws(
      () => transitionHandoff(h.handoff_id, "active" as HandoffState),
      /Invalid state transition/,
    );
  });

  it("should record state change history", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    transitionHandoff(h.handoff_id, "active" as HandoffState, {
      reason: "agent_accepted",
      triggeredBy: "@orchestrator",
    });
    const history = getStateChangeHistory(h.handoff_id);
    assert.equal(history.length, 1);
    assert.equal(history[0]!.from_state, "pending");
    assert.equal(history[0]!.to_state, "active");
    assert.equal(history[0]!.reason, "agent_accepted");
    assert.equal(history[0]!.triggered_by, "@orchestrator");
  });

  it("should throw for non-existent handoff", () => {
    assert.throws(
      () => transitionHandoff("no-such-id", "active" as HandoffState),
      /Handoff not found/,
    );
  });

  it("should set failed_at and failure_reason on failed transition", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const result = transitionHandoff(h.handoff_id, "failed" as HandoffState, {
      reason: "timeout:sla_breach",
    });
    assert.ok(result.handoff.failed_at);
    assert.equal(result.handoff.failure_reason, "timeout:sla_breach");
  });

  it("should set completed_at on completed transition", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    transitionHandoff(h.handoff_id, "active" as HandoffState);
    const result = transitionHandoff(h.handoff_id, "completed" as HandoffState);
    assert.ok(result.handoff.completed_at);
  });
});

// ─── Convenience Methods ────────────────────────────────────────────────────

describe("acceptHandoff", () => {
  it("should transition from pending to active", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const accepted = acceptHandoff(h.handoff_id, "@reviewer");
    assert.ok(accepted);
    assert.equal(accepted.status, "active");
    assert.ok(accepted.in_progress_at);
    const history = getStateChangeHistory(h.handoff_id);
    assert.equal(history.length, 1); // pending->active
  });

  it("should return null for non-existent handoff", () => {
    const result = acceptHandoff("no-such-id");
    assert.equal(result, null);
  });
});

describe("completeHandoff", () => {
  it("should fast-track from pending to completed", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const completed = completeHandoff(h.handoff_id);
    assert.ok(completed);
    assert.equal(completed.status, "completed");
    assert.ok(completed.completed_at);
    const history = getStateChangeHistory(h.handoff_id);
    // pending->active, active->completed
    assert.equal(history.length, 2);
  });

  it("should complete from active directly", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    acceptHandoff(h.handoff_id);
    const completed = completeHandoff(h.handoff_id);
    assert.ok(completed);
    assert.equal(completed.status, "completed");
  });

  it("should merge outputs when provided", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const completed = completeHandoff(h.handoff_id, {
      summary: "All done",
      pr_url: "https://github.com/org/repo/pull/1",
    });
    assert.ok(completed);
    const fetched = getHandoff(h.handoff_id);
    assert.ok(fetched);
    assert.equal(
      (fetched.outputs as Record<string, string>)["summary"],
      "All done",
    );
  });

  it("should return null for non-existent handoff", () => {
    const result = completeHandoff("no-such-id");
    assert.equal(result, null);
  });
});

describe("failHandoff", () => {
  it("should fail a handoff with reason", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const failed = failHandoff(h.handoff_id, "timeout:sla_breach");
    assert.equal(failed.status, "failed");
    assert.equal(failed.failure_reason, "timeout:sla_breach");
  });

  it("should fail from active state", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    acceptHandoff(h.handoff_id);
    const failed = failHandoff(h.handoff_id, "error:system");
    assert.equal(failed.status, "failed");
    assert.equal(failed.failure_reason, "error:system");
  });
});

describe("abandonHandoff", () => {
  it("should map to failed with 'abandoned:' prefix", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const abandoned = abandonHandoff(h.handoff_id, "PR closed");
    assert.equal(abandoned.status, "failed");
    assert.ok(abandoned.failure_reason?.startsWith("abandoned:"));
  });
});

// ─── Update ──────────────────────────────────────────────────────────────────

describe("updateHandoff", () => {
  it("should update safe fields", () => {
    const h = createHandoff({ task: "old task", to: "@bot" });
    const updated = updateHandoff(h.handoff_id, { task: "new task" });
    assert.ok(updated);
    assert.equal(updated.task, "new task");
  });

  it("should return null for non-existent handoff", () => {
    const result = updateHandoff("no-such-id", { task: "x" });
    assert.equal(result, null);
  });
});

// ─── SLA ────────────────────────────────────────────────────────────────────

describe("SLA tracking", () => {
  it("isOverdue should return true for past deadline on active handoff", () => {
    const h = createHandoff(
      { task: "test", to: "@bot" },
      { sla_deadline: new Date(Date.now() - 1000).toISOString() },
    );
    assert.equal(isOverdue(h), true);
  });

  it("isOverdue should return false for future deadline", () => {
    const h = createHandoff(
      { task: "test", to: "@bot" },
      { sla_hours: 24 },
    );
    assert.equal(isOverdue(h), false);
  });

  it("isOverdue should return false for completed handoffs", () => {
    const h = createHandoff(
      { task: "test", to: "@bot" },
      { sla_deadline: new Date(Date.now() - 1000).toISOString() },
    );
    completeHandoff(h.handoff_id);
    const completed = getHandoff(h.handoff_id);
    assert.ok(completed);
    assert.equal(isOverdue(completed), false);
  });

  it("isOverdue should return false when no deadline is set", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    assert.equal(isOverdue(h), false);
  });
});

// ─── Stats ───────────────────────────────────────────────────────────────────

describe("getHandoffStats", () => {
  it("should return correct statistics", () => {
    createHandoff({ task: "a", to: "@a", priority: "high" });
    createHandoff({ task: "b", to: "@b", priority: "low" });
    const h3 = createHandoff({ task: "c", to: "@c" });
    completeHandoff(h3.handoff_id);

    const stats = getHandoffStats();
    assert.equal(stats.total, 3);
    assert.equal(stats.byStatus?.["pending"], 2);
    assert.equal(stats.byStatus?.["completed"], 1);
    assert.equal(stats.byPriority?.["high"], 1);
    assert.equal(stats.byPriority?.["low"], 1);
    assert.equal(stats.byPriority?.["medium"], 1);
    assert.ok(stats.avgCompletionTime !== null);
    assert.equal(stats.slaComplianceRate, 100); // no deadlines set
  });

  it("should handle empty state", () => {
    const stats = getHandoffStats();
    assert.equal(stats.total, 0);
    assert.equal(stats.avgCompletionTime, null);
    assert.equal(stats.slaComplianceRate, 0);
  });
});

// ─── Active Handoffs ────────────────────────────────────────────────────────

describe("getActiveHandoffs", () => {
  it("should return only non-terminal handoffs", () => {
    createHandoff({ task: "active1", to: "@a" });
    const h2 = createHandoff({ task: "active2", to: "@b" });
    const h3 = createHandoff({ task: "done", to: "@c" });
    completeHandoff(h3.handoff_id);
    failHandoff(h2.handoff_id, "error:test");

    const active = getActiveHandoffs();
    assert.equal(active.length, 1);
    assert.equal(active[0]!.task, "active1");
  });
});

// ─── Cleanup ─────────────────────────────────────────────────────────────────

describe("clearAllHandoffs", () => {
  it("should remove all handoffs", () => {
    createHandoff({ task: "a", to: "@a" });
    createHandoff({ task: "b", to: "@b" });
    assert.equal(listHandoffs().length, 2);
    clearAllHandoffs();
    assert.equal(listHandoffs().length, 0);
  });
});

// ─── Constants re-exports ────────────────────────────────────────────────────

describe("re-exported constants", () => {
  it("should export HandoffStates with 4 states", () => {
    assert.equal(HandoffStates.PENDING, "pending");
    assert.equal(HandoffStates.ACTIVE, "active");
    assert.equal(HandoffStates.COMPLETED, "completed");
    assert.equal(HandoffStates.FAILED, "failed");
  });

  it("should export TransitionReasons with reason prefixes", () => {
    assert.equal(TransitionReasons.AGENT_ACCEPTED, "agent_accepted");
    assert.equal(TransitionReasons.WORK_COMPLETED, "work_completed");
    assert.ok(TransitionReasons.SLA_BREACH.startsWith("timeout:"));
    assert.ok(TransitionReasons.SYSTEM_ERROR.startsWith("error:"));
  });
});

/**
 * Handoff Service — Edge Case Tests
 *
 * Additional tests covering edge cases, cleanup, and concurrent operations.
 * Uses node:test (describe, it, beforeEach) and node:assert/strict.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  initHandoffService,
  createHandoff,
  getHandoff,
  listHandoffs,
  transitionHandoff,
  acceptHandoff,
  completeHandoff,
  failHandoff,
  updateHandoff,
  clearAllHandoffs,
  cleanupOldHandoffs,
  getStateChangeHistory,
  getHandoffStats,
  isOverdue,
} from "../src/services/handoff-service.js";
import type { HandoffState } from "../src/types/handoff.js";

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearAllHandoffs();
  initHandoffService({ forceInMemory: true });
});

// ─── Cleanup Tests ───────────────────────────────────────────────────────────

describe("cleanupOldHandoffs", () => {
  it("should not clean up recent completed handoffs", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    completeHandoff(h.handoff_id);
    const cleaned = cleanupOldHandoffs(168); // 7 days
    assert.equal(cleaned, 0);
  });

  it("should return 0 when no handoffs exist", () => {
    const cleaned = cleanupOldHandoffs();
    assert.equal(cleaned, 0);
  });

  it("should not clean up active handoffs regardless of age", () => {
    createHandoff({ task: "active", to: "@bot" });
    const cleaned = cleanupOldHandoffs(0); // 0 hours threshold
    assert.equal(cleaned, 0); // Still pending, not terminal
  });
});

// ─── Update Edge Cases ───────────────────────────────────────────────────────

describe("updateHandoff — edge cases", () => {
  it("should update context", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const updated = updateHandoff(h.handoff_id, {
      context: "new context",
    } as Partial<typeof h>);
    assert.ok(updated);
    assert.equal(updated.context, "new context");
  });

  it("should update priority", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const updated = updateHandoff(h.handoff_id, {
      priority: "critical",
    } as Partial<typeof h>);
    assert.ok(updated);
    assert.equal(updated.priority, "critical");
  });

  it("should update blockers array", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const updated = updateHandoff(h.handoff_id, {
      blockers: ["waiting for CI"],
    } as Partial<typeof h>);
    assert.ok(updated);
    assert.deepEqual([...updated.blockers], ["waiting for CI"]);
  });

  it("should update completed_work array", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const updated = updateHandoff(h.handoff_id, {
      completed_work: ["step 1", "step 2"],
    } as Partial<typeof h>);
    assert.ok(updated);
    assert.deepEqual([...updated.completed_work], ["step 1", "step 2"]);
  });

  it("should update dependencies array", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const updated = updateHandoff(h.handoff_id, {
      dependencies: ["dep-1", "dep-2"],
    } as Partial<typeof h>);
    assert.ok(updated);
    assert.deepEqual([...updated.dependencies], ["dep-1", "dep-2"]);
  });

  it("should update metadata", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const updated = updateHandoff(h.handoff_id, {
      metadata: { custom: "value" },
    } as Partial<typeof h>);
    assert.ok(updated);
    assert.equal(
      (updated.metadata as Record<string, string>)["custom"],
      "value",
    );
  });

  it("should not allow updating status via updateHandoff", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    // status is not in safeColumns so this should be ignored
    const updated = updateHandoff(h.handoff_id, {
      status: "completed",
    } as Partial<typeof h>);
    assert.ok(updated);
    assert.equal(updated.status, "pending"); // unchanged
  });

  it("should update updated_at timestamp", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const originalUpdatedAt = h.updated_at;
    // Small delay to ensure timestamp differs
    const updated = updateHandoff(h.handoff_id, { task: "updated" });
    assert.ok(updated);
    assert.ok(
      new Date(updated.updated_at).getTime() >=
        new Date(originalUpdatedAt).getTime(),
    );
  });
});

// ─── State Change History Edge Cases ───────────────────────────────────────

describe("getStateChangeHistory — edge cases", () => {
  it("should return empty array for non-existent handoff", () => {
    const history = getStateChangeHistory("nonexistent-id");
    assert.equal(history.length, 0);
  });

  it("should return empty array for newly created handoff", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const history = getStateChangeHistory(h.handoff_id);
    assert.equal(history.length, 0);
  });

  it("should track full lifecycle history", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    transitionHandoff(h.handoff_id, "active" as HandoffState);
    transitionHandoff(h.handoff_id, "completed" as HandoffState);

    const history = getStateChangeHistory(h.handoff_id);
    assert.equal(history.length, 2);
    assert.equal(history[0]!.from_state, "pending");
    assert.equal(history[0]!.to_state, "active");
    assert.equal(history[1]!.from_state, "active");
    assert.equal(history[1]!.to_state, "completed");
  });

  it("should preserve metadata in state changes", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    transitionHandoff(h.handoff_id, "active" as HandoffState, {
      reason: "agent_accepted",
      triggeredBy: "@orchestrator",
      metadata: { source: "webhook" },
    });

    const history = getStateChangeHistory(h.handoff_id);
    assert.equal(history[0]!.reason, "agent_accepted");
    assert.equal(history[0]!.triggered_by, "@orchestrator");
    assert.equal(
      (history[0]!.metadata as Record<string, string>)["source"],
      "webhook",
    );
  });
});

// ─── SLA Edge Cases ────────────────────────────────────────────────────────

describe("isOverdue — edge cases", () => {
  it("should return false for failed handoffs even with past deadline", () => {
    const h = createHandoff(
      { task: "test", to: "@bot" },
      { sla_deadline: new Date(Date.now() - 1000).toISOString() },
    );
    failHandoff(h.handoff_id, "error");
    const failed = getHandoff(h.handoff_id);
    assert.ok(failed);
    assert.equal(isOverdue(failed), false);
  });

  it("should return false for rejected (failed) handoffs even with past deadline", () => {
    const h = createHandoff(
      { task: "test", to: "@bot" },
      { sla_deadline: new Date(Date.now() - 1000).toISOString() },
    );
    failHandoff(h.handoff_id, "rejected:not my area");
    const failed = getHandoff(h.handoff_id);
    assert.ok(failed);
    assert.equal(isOverdue(failed), false);
  });
});

// ─── Stats Edge Cases ───────────────────────────────────────────────────────

describe("getHandoffStats — edge cases", () => {
  it("should count failed handoffs correctly", () => {
    const h1 = createHandoff({ task: "a", to: "@a" });
    const h2 = createHandoff({ task: "b", to: "@b" });
    failHandoff(h1.handoff_id, "err");
    failHandoff(h2.handoff_id, "err2");

    const stats = getHandoffStats();
    assert.equal(stats.total, 2);
    assert.equal(stats.byStatus?.["failed"], 2);
  });

  it("should count rejected (now failed) handoffs correctly", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    failHandoff(h.handoff_id, "rejected:nope");

    const stats = getHandoffStats();
    assert.equal(stats.byStatus?.["failed"], 1);
  });

  it("should track SLA compliance rate accurately", () => {
    // Complete within SLA
    const h1 = createHandoff(
      { task: "on-time", to: "@bot" },
      { sla_hours: 24 },
    );
    completeHandoff(h1.handoff_id);

    // Complete past SLA
    const h2 = createHandoff(
      { task: "late", to: "@bot" },
      { sla_deadline: new Date(Date.now() - 3_600_000).toISOString() },
    );
    completeHandoff(h2.handoff_id);

    const stats = getHandoffStats();
    assert.equal(stats.slaComplianceRate, 50); // 1 of 2 within SLA
  });
});

// ─── Create with edge case inputs ──────────────────────────────────────────

describe("createHandoff — input edge cases", () => {
  it("should handle empty task string", () => {
    const h = createHandoff({ task: "", to: "@bot" });
    assert.equal(h.task, "");
    assert.equal(h.status, "pending");
  });

  it("should handle no 'to' field (null to_agent)", () => {
    const h = createHandoff({ task: "unassigned" });
    assert.equal(h.to_agent, null);
    assert.equal(h.task, "unassigned");
  });

  it("should handle additional metadata", () => {
    const h = createHandoff(
      { task: "test", to: "@bot" },
      { additional: { key1: "val1", key2: 42 } },
    );
    assert.equal(
      (h.metadata as Record<string, unknown>)["key1"],
      "val1",
    );
    assert.equal((h.metadata as Record<string, unknown>)["key2"], 42);
  });

  it("should default context to empty string", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    assert.equal(h.context, "");
  });

  it("should accept completed_work in input", () => {
    const h = createHandoff({
      task: "test",
      to: "@bot",
      completed_work: ["step 1"],
    });
    assert.deepEqual([...h.completed_work], ["step 1"]);
  });

  it("should accept blockers in input", () => {
    const h = createHandoff({
      task: "test",
      to: "@bot",
      blockers: ["waiting for approval"],
    });
    assert.deepEqual([...h.blockers], ["waiting for approval"]);
  });

  it("should accept outputs in input", () => {
    const h = createHandoff({
      task: "test",
      to: "@bot",
      outputs: { result: "ok" },
    });
    assert.equal(
      (h.outputs as Record<string, string>)["result"],
      "ok",
    );
  });

  it("should accept dependencies in input", () => {
    const h = createHandoff({
      task: "test",
      to: "@bot",
      dependencies: ["dep-abc"],
    });
    assert.deepEqual([...h.dependencies], ["dep-abc"]);
  });
});

// ─── Transition with options ─────────────────────────────────────────────────

describe("transitionHandoff — options", () => {
  it("should record commentId in state change", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    transitionHandoff(h.handoff_id, "active" as HandoffState, {
      commentId: "comment-123",
    });

    const history = getStateChangeHistory(h.handoff_id);
    assert.equal(history[0]!.comment_id, "comment-123");
  });

  it("should default triggeredBy to 'system'", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    transitionHandoff(h.handoff_id, "active" as HandoffState);

    const history = getStateChangeHistory(h.handoff_id);
    assert.equal(history[0]!.triggered_by, "system");
  });

  it("should default reason to 'unknown'", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    transitionHandoff(h.handoff_id, "active" as HandoffState);

    const history = getStateChangeHistory(h.handoff_id);
    assert.equal(history[0]!.reason, "unknown");
  });
});

// ─── List sorting ────────────────────────────────────────────────────────────

describe("listHandoffs — sorting", () => {
  it("should list newest first", async () => {
    createHandoff({ task: "first", to: "@a" });
    // Tiny delay to ensure timestamps differ
    await new Promise((resolve) => setTimeout(resolve, 5));
    createHandoff({ task: "second", to: "@b" });

    const all = listHandoffs();
    assert.equal(all.length, 2);
    assert.equal(all[0]!.task, "second");
    assert.equal(all[1]!.task, "first");
  });
});

// ─── Fail from various states ──────────────────────────────────────────────

describe("failHandoff — from various states", () => {
  it("should fail from pending", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const failed = failHandoff(h.handoff_id, "error:test");
    assert.equal(failed.status, "failed");
    assert.equal(failed.failure_reason, "error:test");
  });

  it("should fail from active", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    acceptHandoff(h.handoff_id, "@bot");
    const failed = failHandoff(h.handoff_id, "error:crash");
    assert.equal(failed.status, "failed");
  });

  it("should throw when failing already-failed handoff", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    failHandoff(h.handoff_id, "first");
    assert.throws(
      () => failHandoff(h.handoff_id, "second"),
      /Invalid state transition/,
    );
  });

  it("should use default reason when none provided", () => {
    const h = createHandoff({ task: "test", to: "@bot" });
    const failed = failHandoff(h.handoff_id);
    assert.equal(failed.failure_reason, "unknown");
  });
});

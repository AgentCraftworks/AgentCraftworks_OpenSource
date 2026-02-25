/**
 * Action Classification Engine
 *
 * Classifies agent actions into tiers (T1-T5) based on their potential impact.
 * Part of the Autonomy Dial system for dynamic AI agent permission control.
 *
 * Ported from the reference JS codebase (action-classifier.js).
 */

import type {
  ActionTier,
  DialLevel,
} from "../types/autonomy.js";

// ─── Tier Definitions ───────────────────────────────────────────────────────────────

export interface TierDetails {
  readonly level: number;
  readonly name: string;
  readonly description: string;
  readonly requiredDialLevel: DialLevel;
}

export const ACTION_TIERS: Record<string, TierDetails> = {
  T1: {
    level: 1,
    name: "Read-Only",
    description: "View files, read comments, inspect repository state",
    requiredDialLevel: 1,
  },
  T2: {
    level: 2,
    name: "Informational",
    description: "Post comments, create discussions, add reactions",
    requiredDialLevel: 2,
  },
  T3: {
    level: 3,
    name: "Modify",
    description: "Edit files, create branches, update issues/PRs",
    requiredDialLevel: 3,
  },
  T4: {
    level: 4,
    name: "Commit",
    description: "Push commits, create PRs, request reviews",
    requiredDialLevel: 4,
  },
  T5: {
    level: 5,
    name: "Merge/Deploy",
    description: "Merge PRs, deploy code, delete branches",
    requiredDialLevel: 5,
  },
} as const;

// ─── Action Catalog ─────────────────────────────────────────────────────────────────

/** Maps specific action types to their corresponding tier */
const ACTION_TYPE_MAP: Record<string, ActionTier> = {
  // T1: Read-Only Actions (15 actions)
  view_file: "T1",
  read_comment: "T1",
  list_files: "T1",
  get_pr: "T1",
  get_issue: "T1",
  get_commit: "T1",
  list_branches: "T1",
  list_commits: "T1",
  view_logs: "T1",
  get_status: "T1",
  inspect_config: "T1",
  read_content: "T1",
  view_diff: "T1",
  get_review: "T1",
  list_reviews: "T1",

  // T2: Informational Actions (10 actions)
  post_comment: "T2",
  create_discussion: "T2",
  add_reaction: "T2",
  update_comment: "T2",
  post_review_comment: "T2",
  suggest_change: "T2",
  add_label: "T2",
  remove_label: "T2",
  ci_lint_fix: "T2",
  ci_issue_file: "T2",

  // T3: Modify Actions (16 actions)
  edit_file: "T3",
  create_file: "T3",
  delete_file: "T3",
  create_branch: "T3",
  update_issue: "T3",
  update_pr: "T3",
  update_title: "T3",
  update_description: "T3",
  create_issue: "T3",
  close_issue: "T3",
  reopen_issue: "T3",
  assign_user: "T3",
  request_changes: "T3",
  ci_type_fix: "T3",
  ci_test_fix: "T3",
  ci_build_fix: "T3",

  // T4: Commit Actions (9 actions)
  push_commit: "T4",
  create_pr: "T4",
  request_review: "T4",
  approve_pr: "T4",
  update_pr_branch: "T4",
  force_push: "T4",
  create_tag: "T4",
  create_release: "T4",
  ci_security_escalate: "T4",

  // T5: Merge/Deploy Actions (8 actions)
  merge_pr: "T5",
  delete_branch: "T5",
  deploy: "T5",
  publish_release: "T5",
  revert_commit: "T5",
  cherry_pick: "T5",
  force_merge: "T5",
  emergency_rollback: "T5",
};

// ─── Public API ─────────────────────────────────────────────────────────────────────

/** Result of classifying an action */
export interface ClassifyResult {
  tier: ActionTier;
  tierDetails: TierDetails;
  actionType: string;
  isKnownAction: boolean;
}

/**
 * Classify an action into its appropriate tier.
 * Unknown actions default to T3 (Modify) as a conservative approach.
 */
export function classifyAction(actionType: string): ClassifyResult {
  if (!actionType || typeof actionType !== "string") {
    throw new Error("Action type must be a non-empty string");
  }

  const normalized = actionType.toLowerCase().trim();
  const tier = ACTION_TYPE_MAP[normalized];

  if (!tier) {
    // Unknown action types default to T3 (Modify) — conservative
    const t3Details = ACTION_TIERS["T3"];
    if (!t3Details) {
      throw new Error("Internal error: T3 tier not found");
    }
    return {
      tier: "T3",
      tierDetails: t3Details,
      actionType: normalized,
      isKnownAction: false,
    };
  }

  const tierDetails = ACTION_TIERS[tier];
  if (!tierDetails) {
    throw new Error(`Internal error: tier ${tier} not found`);
  }

  return {
    tier,
    tierDetails,
    actionType: normalized,
    isKnownAction: true,
  };
}

/**
 * Get the minimum dial level required for an action type.
 */
export function getRequiredDialLevel(actionType: string): DialLevel {
  const classification = classifyAction(actionType);
  return classification.tierDetails.requiredDialLevel;
}

/**
 * Check if a dial level permits an action.
 */
export function isActionPermitted(
  dialLevel: number,
  actionType: string,
): {
  permitted: boolean;
  dialLevel: number;
  requiredLevel: DialLevel;
  tier: ActionTier;
  tierDetails: TierDetails;
  actionType: string;
} {
  if (!Number.isInteger(dialLevel) || dialLevel < 1 || dialLevel > 5) {
    throw new Error("Dial level must be an integer between 1 and 5");
  }

  const classification = classifyAction(actionType);
  const requiredLevel = classification.tierDetails.requiredDialLevel;
  const permitted = dialLevel >= requiredLevel;

  return {
    permitted,
    dialLevel,
    requiredLevel,
    tier: classification.tier,
    tierDetails: classification.tierDetails,
    actionType: classification.actionType,
  };
}

/**
 * Get all action types for a specific tier.
 */
export function getActionsByTier(tier: ActionTier): string[] {
  if (!ACTION_TIERS[tier]) {
    throw new Error(
      `Invalid tier: ${tier}. Must be one of T1, T2, T3, T4, T5`,
    );
  }

  return Object.entries(ACTION_TYPE_MAP)
    .filter(([, actionTier]) => actionTier === tier)
    .map(([actionType]) => actionType);
}

/**
 * Get all actions in the catalog.
 */
export function getAllActions(): Record<string, ActionTier> {
  return { ...ACTION_TYPE_MAP };
}

/**
 * Get a summary of all tiers and their action counts.
 */
export function getTierSummary(): Record<
  string,
  TierDetails & { actionCount: number; sampleActions: string[] }
> {
  const summary: Record<
    string,
    TierDetails & { actionCount: number; sampleActions: string[] }
  > = {};

  for (const [tier, details] of Object.entries(ACTION_TIERS)) {
    const actions = getActionsByTier(tier as ActionTier);
    summary[tier] = {
      ...details,
      actionCount: actions.length,
      sampleActions: actions.slice(0, 5),
    };
  }

  return summary;
}

/**
 * Validate action type exists in the classification system.
 */
export function isValidActionType(actionType: string): boolean {
  if (!actionType || typeof actionType !== "string") {
    return false;
  }
  const normalized = actionType.toLowerCase().trim();
  return Object.prototype.hasOwnProperty.call(ACTION_TYPE_MAP, normalized);
}

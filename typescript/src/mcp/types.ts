/**
 * MCP Server types
 *
 * Types specific to the Model Context Protocol (MCP) server integration.
 * These types define the tool input schemas and response formats
 * used by the MCP server to expose handoff operations to VS Code / GitHub Copilot.
 */

import type { Priority, HandoffState } from "../types/handoff.js";

// ─── Tool Input Types ────────────────────────────────────────────────────────────────

/** Input parameters for the create_handoff MCP tool */
export interface CreateHandoffToolInput {
  to_agent: string;
  task: string;
  context?: string;
  priority?: Priority;
  repository: string;
  issue_number: number;
  sla_hours?: number;
}

/** Input parameters for the accept_handoff MCP tool */
export interface AcceptHandoffToolInput {
  handoff_id: string;
  agent_name: string;
  notes?: string;
}

/** Input parameters for the complete_handoff MCP tool */
export interface CompleteHandoffToolInput {
  handoff_id: string;
  agent_name: string;
  outputs?: HandoffOutputs;
}

/** Output deliverables from a completed handoff */
export interface HandoffOutputs {
  summary?: string;
  deliverables?: string[];
  notes?: string;
}

/** Input parameters for the query_workflow_state MCP tool */
export interface QueryWorkflowStateToolInput {
  handoff_id?: string;
  status?: HandoffState;
  to_agent?: string;
  repository?: string;
}

/** Input parameters for the attach_context MCP tool */
export interface AttachContextToolInput {
  handoff_id: string;
  schema_name: string;
  data: Record<string, unknown>;
  created_by: string;
}

/** Input parameters for the get_context MCP tool */
export interface GetContextToolInput {
  handoff_id?: string;
  schema_name?: string;
  context_id?: string;
}

// ─── Tool Response Types ─────────────────────────────────────────────────────────────

/** MCP tool response content item */
export interface McpTextContent {
  type: "text";
  text: string;
}

/** Standard MCP tool result */
export interface McpToolResult {
  content: McpTextContent[];
  isError?: boolean;
}

/** Successful create_handoff response payload */
export interface CreateHandoffResponse {
  success: true;
  handoff_id: string;
  status: HandoffState;
  to_agent: string | null;
  task: string;
  priority: Priority;
  sla_deadline: string | null;
  created_at: string;
}

/** Successful accept_handoff response payload */
export interface AcceptHandoffResponse {
  success: true;
  handoff_id: string;
  status: HandoffState;
  agent: string;
  task: string;
  accepted_at: string;
  notes?: string;
}

/** Successful complete_handoff response payload */
export interface CompleteHandoffResponse {
  success: true;
  handoff_id: string;
  status: HandoffState;
  agent: string;
  task: string;
  outputs: Record<string, unknown>;
  completed_at: string;
}

/** Single handoff in a query result */
export interface HandoffQueryItem {
  handoff_id: string;
  status: HandoffState;
  from_agent: string | null;
  to_agent: string | null;
  task: string;
  priority: Priority;
  created_at: string;
  repository: string;
  issue_number: number | null;
}

/** Query response for a single handoff */
export interface SingleHandoffQueryResponse extends HandoffQueryItem {
  updated_at: string;
  sla_deadline: string | null;
}

/** Query response for listing handoffs */
export interface HandoffListQueryResponse {
  count: number;
  filters: Record<string, unknown>;
  handoffs: HandoffQueryItem[];
}

/** Successful attach_context response payload */
export interface AttachContextResponse {
  success: true;
  context_id: string;
  handoff_id: string;
  schema_name: string;
  schema_version: string;
  created_by: string;
  created_at: string;
}

/** Context item in get_context response */
export interface ContextQueryItem {
  id: string;
  schema_name: string;
  schema_version: string;
  data: Record<string, unknown>;
  created_by: string;
  handoff_id: string;
  created_at: string;
}

/** Successful get_context response payload */
export interface GetContextResponse {
  count: number;
  contexts: ContextQueryItem[];
}

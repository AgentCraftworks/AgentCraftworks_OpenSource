/**
 * Type definitions for structured context system
 * Enables agents to pass typed data (security findings, code reviews, test results)
 */

import type { JSONSchemaType } from "ajv";

/**
 * A context schema defines the structure for typed context data
 */
export interface ContextSchema {
  name: string; // e.g., "security-finding"
  version: string; // e.g., "1.0.0"
  json_schema: JSONSchemaType<unknown>; // JSON Schema definition
  description?: string;
  created_at: string;
  updated_at: string;
}

/**
 * A context instance contains validated structured data attached to a handoff
 */
export interface Context {
  id: string; // UUID
  schema_name: string;
  schema_version: string;
  data: Record<string, unknown>; // Validated JSON data
  created_by: string; // Agent name
  handoff_id: string; // UUID of associated handoff
  created_at: string;
}

/**
 * Input for creating a new context
 */
export interface CreateContextInput {
  schema_name: string;
  data: Record<string, unknown>;
  created_by: string;
  handoff_id: string;
}

/**
 * Input for registering a new schema
 */
export interface RegisterSchemaInput {
  name: string;
  version: string;
  json_schema: JSONSchemaType<unknown>;
  description?: string;
}

/**
 * Query filters for contexts
 */
export interface ContextFilters {
  handoff_id?: string;
  schema_name?: string;
  created_by?: string;
}

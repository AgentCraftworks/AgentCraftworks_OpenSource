/**
 * Built-in context schemas for common agent interactions
 * These schemas are registered automatically when the context service initializes
 */

import type { JSONSchemaType } from "ajv";
import type { RegisterSchemaInput } from "../types/context.js";

// ─── Security Finding Schema ──────────────────────────────────────────────────────

interface SecurityFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  cwe?: string; // e.g., "CWE-79"
  file: string;
  line: number;
  description: string;
  remediation: string;
}

export const securityFindingSchema: JSONSchemaType<SecurityFinding> = {
  type: "object",
  properties: {
    severity: {
      type: "string",
      enum: ["critical", "high", "medium", "low", "info"],
    },
    cwe: { type: "string", nullable: true },
    file: { type: "string" },
    line: { type: "number" },
    description: { type: "string" },
    remediation: { type: "string" },
  },
  required: ["severity", "file", "line", "description", "remediation"],
  additionalProperties: false,
};

// ─── Code Review Schema ───────────────────────────────────────────────────────────

interface CodeReview {
  file: string;
  line_start: number;
  line_end: number;
  category: "bug" | "performance" | "style" | "security" | "best-practice";
  suggestion: string;
  severity: "blocker" | "major" | "minor" | "info";
}

export const codeReviewSchema: JSONSchemaType<CodeReview> = {
  type: "object",
  properties: {
    file: { type: "string" },
    line_start: { type: "number" },
    line_end: { type: "number" },
    category: {
      type: "string",
      enum: ["bug", "performance", "style", "security", "best-practice"],
    },
    suggestion: { type: "string" },
    severity: {
      type: "string",
      enum: ["blocker", "major", "minor", "info"],
    },
  },
  required: [
    "file",
    "line_start",
    "line_end",
    "category",
    "suggestion",
    "severity",
  ],
  additionalProperties: false,
};

// ─── Test Result Schema ───────────────────────────────────────────────────────────

interface TestResult {
  suite: string;
  name: string;
  status: "passed" | "failed" | "skipped" | "error";
  duration: number; // milliseconds
  error_message?: string;
}

export const testResultSchema: JSONSchemaType<TestResult> = {
  type: "object",
  properties: {
    suite: { type: "string" },
    name: { type: "string" },
    status: {
      type: "string",
      enum: ["passed", "failed", "skipped", "error"],
    },
    duration: { type: "number" },
    error_message: { type: "string", nullable: true },
  },
  required: ["suite", "name", "status", "duration"],
  additionalProperties: false,
};

// ─── Built-in schema definitions ──────────────────────────────────────────────────

export const BUILT_IN_SCHEMAS: RegisterSchemaInput[] = [
  {
    name: "security-finding",
    version: "1.0.0",
    json_schema: securityFindingSchema as JSONSchemaType<unknown>,
    description:
      "Security vulnerability finding with severity, location, and remediation",
  },
  {
    name: "code-review",
    version: "1.0.0",
    json_schema: codeReviewSchema as JSONSchemaType<unknown>,
    description:
      "Code review comment with file location, category, and severity",
  },
  {
    name: "test-result",
    version: "1.0.0",
    json_schema: testResultSchema as JSONSchemaType<unknown>,
    description: "Test execution result with status, duration, and errors",
  },
];

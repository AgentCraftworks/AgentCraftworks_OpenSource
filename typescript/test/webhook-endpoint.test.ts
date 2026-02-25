/**
 * Webhook Endpoint Integration Tests
 *
 * Tests the /api/webhook endpoint with signature verification middleware.
 * Validates that:
 *  - Valid signatures allow requests through (2xx)
 *  - Missing signatures are rejected (401)
 *  - Invalid signatures are rejected (401)
 *
 * Uses node:test and node:assert/strict.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { verifyWebhookSignatureMiddleware } from "../src/middleware/webhook-signature.js";
import { clearAllHandoffs } from "../src/services/handoff-service.js";

// ─── Test Helpers ───────────────────────────────────────────────────────────

const TEST_SECRET = "test-webhook-secret-integration";

/** Create a valid HMAC-SHA256 signature for a payload */
function sign(payload: string, secret: string = TEST_SECRET): string {
  const hmac = crypto.createHmac("sha256", secret);
  return "sha256=" + hmac.update(payload).digest("hex");
}

/** Simple webhook handler that returns success */
function mockWebhookHandler(req: Request, res: Response): void {
  res.status(200).json({ success: true, action: req.body.action });
}

// ─── Test Express App ───────────────────────────────────────────────────────

const app = express();

// Rate limiter for webhook endpoint to prevent abuse / DoS
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // allow up to 100 webhook requests per minute from a single IP
  standardHeaders: true,
  legacyHeaders: false,
});

// Parse JSON and attach raw body for webhook signature verification
app.use(
  express.json({
    verify: (req: Request, _res: Response, buf: Buffer) => {
      (req as unknown as Record<string, unknown>)["rawBody"] = buf.toString("utf-8");
    },
  }),
);

// Webhook endpoint with signature verification and rate limiting
app.post("/api/webhook", webhookLimiter, verifyWebhookSignatureMiddleware(TEST_SECRET), mockWebhookHandler);

let server: http.Server;
let baseUrl: string;

async function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

before(async () => {
  await startServer();
  clearAllHandoffs();
});

after(async () => {
  await stopServer();
});

describe("POST /api/webhook - signature verification", () => {
  it("should accept request with valid signature", async () => {
    const payload = JSON.stringify({ action: "opened", pull_request: { number: 1 } });
    const signature = sign(payload);

    const response = await fetch(`${baseUrl}/api/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      },
      body: payload,
    });

    assert.equal(response.status, 200);
    const data = (await response.json()) as { success: boolean; action: string };
    assert.equal(data.success, true);
    assert.equal(data.action, "opened");
  });

  it("should reject request with missing signature (401)", async () => {
    const payload = JSON.stringify({ action: "opened", pull_request: { number: 2 } });

    const response = await fetch(`${baseUrl}/api/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // No X-Hub-Signature-256 header
      },
      body: payload,
    });

    assert.equal(response.status, 401);
    const data = (await response.json()) as { error: string; message: string };
    assert.equal(data.error, "Unauthorized");
    assert.match(data.message, /signature/i);
  });

  it("should reject request with invalid signature (401)", async () => {
    const payload = JSON.stringify({ action: "synchronize", pull_request: { number: 3 } });
    const invalidSignature = "sha256=0000000000000000000000000000000000000000000000000000000000000000";

    const response = await fetch(`${baseUrl}/api/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": invalidSignature,
      },
      body: payload,
    });

    assert.equal(response.status, 401);
    const data = (await response.json()) as { error: string; message: string };
    assert.equal(data.error, "Unauthorized");
    assert.match(data.message, /signature/i);
  });

  it("should reject request with tampered payload (401)", async () => {
    const originalPayload = JSON.stringify({ action: "opened", pull_request: { number: 4 } });
    const signature = sign(originalPayload);
    
    // Send a different payload with the signature of the original
    const tamperedPayload = JSON.stringify({ action: "closed", pull_request: { number: 99 } });

    const response = await fetch(`${baseUrl}/api/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      },
      body: tamperedPayload,
    });

    assert.equal(response.status, 401);
    const data = (await response.json()) as { error: string; message: string };
    assert.equal(data.error, "Unauthorized");
  });

  it("should reject request with wrong secret signature (401)", async () => {
    const payload = JSON.stringify({ action: "reopened", pull_request: { number: 5 } });
    const wrongSecretSignature = sign(payload, "wrong-secret");

    const response = await fetch(`${baseUrl}/api/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": wrongSecretSignature,
      },
      body: payload,
    });

    assert.equal(response.status, 401);
    const data = (await response.json()) as { error: string; message: string };
    assert.equal(data.error, "Unauthorized");
  });

  it("should reject request with empty body (400)", async () => {
    const payload = "";
    const signature = sign(payload);

    const response = await fetch(`${baseUrl}/api/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      },
      body: payload,
    });

    assert.equal(response.status, 400);
    const data = (await response.json()) as { error: string; message: string };
    assert.equal(data.error, "Bad Request");
    assert.match(data.message, /empty/i);
  });

  it("should accept request with signature prefix sha256=", async () => {
    const payload = JSON.stringify({ action: "edited", pull_request: { number: 6 } });
    const signature = sign(payload);

    assert.match(signature, /^sha256=/);

    const response = await fetch(`${baseUrl}/api/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      },
      body: payload,
    });

    assert.equal(response.status, 200);
  });

  it("should reject request with wrong signature prefix (401)", async () => {
    const payload = JSON.stringify({ action: "labeled", pull_request: { number: 7 } });
    const hmac = crypto.createHmac("sha256", TEST_SECRET);
    const digest = hmac.update(payload).digest("hex");
    // Use sha1= prefix instead of sha256=
    const badSignature = "sha1=" + digest;

    const response = await fetch(`${baseUrl}/api/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": badSignature,
      },
      body: payload,
    });

    assert.equal(response.status, 401);
  });
});

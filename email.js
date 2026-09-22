/**
 * SEVEN BITS COFFEE - TRANSACTIONAL EMAIL (opt-in)
 * Location: /email.js
 *
 * Used only for the customer forgot-password OTP flow (see server.js's
 * POST /api/auth/forgot-password/request) - an owner/admin turns this on
 * in Global Settings and enters a Resend API key + a from-address. Off by
 * default (isEnabled() false) until configured, same opt-in shape as
 * s3.js's storage toggle.
 *
 * Uses Resend's plain REST API (https://resend.com) via Node's built-in
 * https module - deliberately not a new npm dependency for something this
 * small (one POST request, no SDK features this app needs).
 */
"use strict";
const https = require("https");

let apiKey = null;
let fromAddress = null;

function configure(config) {
  if (!config.emailEnabled || !config.emailApiKey || !config.emailFromAddress) {
    apiKey = null;
    fromAddress = null;
    return;
  }
  apiKey = config.emailApiKey;
  fromAddress = config.emailFromAddress;
}

function isEnabled() {
  return !!apiKey;
}

/** Sends a plain-text email. Rejects if the provider returns a non-2xx
 *  response (caller should catch and treat as "couldn't send", never
 *  surface the raw error to an unauthenticated caller - see the OTP
 *  request route's own generic response). */
function sendEmail(to, subject, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ from: fromAddress, to, subject, text });
    const req = https.request(
      {
        hostname: "api.resend.com",
        path: "/emails",
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve();
          else reject(new Error(`Email provider returned ${res.statusCode}: ${data}`));
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = { configure, isEnabled, sendEmail };

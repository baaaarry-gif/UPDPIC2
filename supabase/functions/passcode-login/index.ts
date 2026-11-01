// Passcode login endpoint.
// POST /functions/v1/passcode-login  body: { passcode: string }
// The passcode is verified against a bcrypt hash inside the database
// (passcode_login RPC), which also enforces the failed-attempt lockout.
// On success we mint a session for the matched owner via a magic-link OTP and
// return the session tokens to the browser.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  return ip;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => null);
    const passcode = typeof body?.passcode === "string" ? body.passcode : "";
    if (!passcode || passcode.length > 200) {
      return new Response(JSON.stringify({ error: "That passcode didn't match." }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const client = await sha256Hex(clientKey(req));
    const { data: email, error: rpcErr } = await admin.rpc("passcode_login", {
      p_passcode: passcode,
      p_client: client,
    });

    if (rpcErr) {
      if (rpcErr.message?.includes("PASSCODE_LOCKED")) {
        return new Response(
          JSON.stringify({ error: "Too many attempts. Please wait 15 minutes and try again." }),
          { status: 429, headers: jsonHeaders }
        );
      }
      throw new Error(rpcErr.message);
    }
    if (!email) {
      return new Response(JSON.stringify({ error: "That passcode didn't match." }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: String(email),
    });
    if (linkErr) throw new Error(`generateLink: ${linkErr.message}`);

    const hashedToken = linkData?.properties?.hashed_token;
    if (!hashedToken) throw new Error("Could not generate session token");

    const verifyClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: verified, error: verifyErr } = await verifyClient.auth.verifyOtp({
      type: "magiclink",
      token_hash: hashedToken,
    });
    if (verifyErr) throw verifyErr;
    if (!verified.session) throw new Error("No session returned");

    return new Response(
      JSON.stringify({
        access_token: verified.session.access_token,
        refresh_token: verified.session.refresh_token,
        expires_in: verified.session.expires_in,
      }),
      { headers: jsonHeaders }
    );
  } catch (err) {
    console.error("passcode-login failed", err);
    return new Response(
      JSON.stringify({ error: "Could not sign in right now. Please try again." }),
      { status: 500, headers: jsonHeaders }
    );
  }
});

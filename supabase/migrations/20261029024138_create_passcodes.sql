/*
# Create passcodes table (passcode login for the owner)

## Purpose
Lets the owner sign in with a personal passcode instead of email/password.
The passcode is looked up by an edge function (verify_jwt=false) which
returns a short-lived Supabase session for the matched user. Only the owner
can create/manage passcodes from the authenticated app.

## New Table
- `passcodes`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, references auth.users, cascade)
  - `passcode` (text, unique, not null) — the secret keyword
  - `label` (text, default 'My passcode')
  - `created_at` (timestamptz)
  - `last_used_at` (timestamptz, nullable)

## Security
- RLS enabled.
- Owner-only CRUD: `TO authenticated` with `auth.uid() = user_id`.
- `anon` has NO access — passcodes are never readable by the public.
- `service_role` has SELECT for the edge-function lookup.
- The edge function receives the passcode, looks up the user_id, then
  mints a session via service-role admin APIs. The passcode itself is
  never returned to the client.
*/

CREATE TABLE IF NOT EXISTS passcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passcode text UNIQUE NOT NULL,
  label text NOT NULL DEFAULT 'My passcode',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE passcodes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON passcodes TO authenticated;
GRANT SELECT ON passcodes TO service_role;

DROP POLICY IF EXISTS "select_own_passcodes" ON passcodes;
CREATE POLICY "select_own_passcodes"
  ON passcodes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_passcodes" ON passcodes;
CREATE POLICY "insert_own_passcodes"
  ON passcodes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_passcodes" ON passcodes;
CREATE POLICY "update_own_passcodes"
  ON passcodes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_passcodes" ON passcodes;
CREATE POLICY "delete_own_passcodes"
  ON passcodes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

/*
# Harden passcode login: hashed storage, attempt lockout, server-only check

## Plain-English summary
The passcode is no longer stored as readable text. It is stored as a salted,
slow-to-compute bcrypt hash. Login checks go through one database function that
counts failed attempts and temporarily blocks further tries after too many misses.
The browser can no longer read the passcodes table at all.

## Changes
1. `passcodes.passcode_hash` (text) added. Existing passcode is hashed (bcrypt, cost 12).
2. `passcodes.passcode` (plaintext) is cleared. The column is kept (not dropped) and no longer holds the secret.
3. New table `passcode_attempts` records failed login attempts (client id + time).
4. New function `passcode_login(p_passcode, p_client)`:
   - Blocks with 'PASSCODE_LOCKED' after 5 failures from one client in 15 minutes,
     or 50 failures overall in one hour.
   - Returns the owner's email on a match, NULL on a mismatch.
   - Runs as its owner, can only be executed by service_role (the edge function).

## Security
- RLS enabled on `passcode_attempts` with no policies and no grants: nobody but the function can touch it.
- All authenticated/anon access to `passcodes` removed; the old owner policies are dropped.
- `passcode_login` has EXECUTE revoked from PUBLIC, anon and authenticated.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE passcodes ADD COLUMN IF NOT EXISTS passcode_hash text;

UPDATE passcodes
SET passcode_hash = extensions.crypt(passcode, extensions.gen_salt('bf', 12))
WHERE passcode_hash IS NULL AND passcode IS NOT NULL;

ALTER TABLE passcodes ALTER COLUMN passcode DROP NOT NULL;
UPDATE passcodes SET passcode = NULL WHERE passcode_hash IS NOT NULL;
ALTER TABLE passcodes ALTER COLUMN passcode_hash SET NOT NULL;

REVOKE ALL ON passcodes FROM authenticated, anon;
DROP POLICY IF EXISTS "select_own_passcodes" ON passcodes;
DROP POLICY IF EXISTS "insert_own_passcodes" ON passcodes;
DROP POLICY IF EXISTS "update_own_passcodes" ON passcodes;
DROP POLICY IF EXISTS "delete_own_passcodes" ON passcodes;

CREATE TABLE IF NOT EXISTS passcode_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS passcode_attempts_client_time_idx
  ON passcode_attempts (client, attempted_at);
CREATE INDEX IF NOT EXISTS passcode_attempts_time_idx
  ON passcode_attempts (attempted_at);

ALTER TABLE passcode_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON passcode_attempts FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.passcode_login(p_passcode text, p_client text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_row_id uuid;
  v_email text;
  v_client_failures int;
  v_global_failures int;
BEGIN
  IF p_client IS NULL OR length(p_client) = 0 THEN
    RAISE EXCEPTION 'Missing client identifier';
  END IF;

  DELETE FROM passcode_attempts WHERE attempted_at < now() - interval '1 day';

  SELECT count(*) INTO v_client_failures
  FROM passcode_attempts
  WHERE client = p_client AND attempted_at > now() - interval '15 minutes';

  SELECT count(*) INTO v_global_failures
  FROM passcode_attempts
  WHERE attempted_at > now() - interval '1 hour';

  IF v_client_failures >= 5 OR v_global_failures >= 50 THEN
    RAISE EXCEPTION 'PASSCODE_LOCKED';
  END IF;

  IF p_passcode IS NOT NULL AND length(p_passcode) BETWEEN 1 AND 200 THEN
    SELECT id, email INTO v_row_id, v_email
    FROM passcodes
    WHERE passcode_hash = extensions.crypt(p_passcode, passcode_hash)
    LIMIT 1;
  END IF;

  IF v_row_id IS NULL THEN
    INSERT INTO passcode_attempts (client) VALUES (p_client);
    RETURN NULL;
  END IF;

  UPDATE passcodes SET last_used_at = now() WHERE id = v_row_id;
  RETURN v_email;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.passcode_login(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passcode_login(text, text) TO service_role;

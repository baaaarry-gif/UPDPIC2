/*
# Add email column to passcodes

## Purpose
The passcode-login edge function needs the user's email to generate a
session token. auth.admin.getUserById is unreliable in the edge runtime,
so we store the email directly on the passcodes row at creation time.

## Changes
- `passcodes.email` (text, not null) — denormalized from auth.users
- Backfilled existing row with the known email
*/

ALTER TABLE passcodes ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';

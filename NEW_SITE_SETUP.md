# New Site Setup Instructions

Paste this whole document into another AI tool (Bolt, Lovable, Cursor, etc.) and ask it to build the site the same way. Replace the bracketed parts with your own details.

---

## 1. Project basics

- Build with Vite, React 18, TypeScript, and Tailwind CSS 3.
- Use lucide-react for all icons (including logos).
- Use `@/` as the import alias for the `src/` folder (for example `@/components/Foo`).
- Do not add other UI, theme, or icon packages unless I ask for them.
- Use `npm run build` and `npm run typecheck` to verify changes before finishing.

## 2. Design direction

- Make it beautiful, production-ready, and fully featured, not a template look.
- Use a dark, sophisticated theme with neutral backgrounds and one accent color. Do not use purple, indigo, or violet.
- Body text line height about 150%, headings about 120%. Use at most 3 font weights.
- Use an 8px spacing grid.
- Make text readable on every background, including during header transitions.
- Add tasteful hover states, transitions, and micro-interactions.
- Make every layout responsive from phone to desktop.
- Keep each screen focused on one job. Reveal secondary actions in modals or drawers.

## 3. Backend: Supabase

- Use Supabase for all data that must persist across reloads.
- The Supabase project is already provisioned. The following environment variable names are pre-filled automatically. Never ask me to paste them and never print their values:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_DB_URL`
- Create every table through migrations applied with the Supabase migration tool.
- Enable row level security on every new table, and add explicit grants and policies in the same migration.
- Use four separate policies per table (select, insert, update, delete). Do not use one "all" policy.
- Never expose the service role key to the browser. Only edge functions may use it.

## 4. Secret-passcode sign-in (the pattern used in this project)

This site signs the owner in with a private passcode instead of an email and password. Build it like this:

1. Store the passcode only as a salted bcrypt hash inside the database (pgcrypto extension, `crypt()` with `gen_salt('bf', 12)`). Never store the plain passcode in any table, file, or log.
2. Create a `passcode_attempts` table (client identifier hash and timestamp). Enable RLS on it and grant nothing to `anon` or `authenticated`.
3. Create a `passcode_login(p_passcode text, p_client text)` database function:
   - Run as `SECURITY DEFINER` with `SET search_path = public, extensions, pg_temp`.
   - Reject the attempt with `PASSCODE_LOCKED` after 5 failures from one client in 15 minutes, or 50 failures overall in one hour.
   - Return the owner's email on a match and NULL otherwise.
   - Revoke EXECUTE from `PUBLIC`, `anon`, and `authenticated`. Grant it only to `service_role`.
4. Create an edge function `passcode-login` (verify_jwt = false) that:
   - Accepts `{ passcode }` as a POST body, limited to 200 characters.
   - Hashes the caller's IP address with SHA-256 and passes it as the client identifier.
   - Calls `passcode_login` with the service role.
   - Returns HTTP 429 with a friendly message when locked, and HTTP 401 with "That passcode didn't match." on a mismatch.
   - Creates a session for the owner (magic-link token, verified server-side) and returns the access and refresh tokens.
   - Returns only generic error messages. Logs details on the server only.
   - Includes the required CORS headers on every response.
5. On the sign-in screen, the passcode field must:
   - Use `type="password"` with a show/hide eye toggle.
   - Set `autoComplete="off"`, `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`, and disable password-manager autofill.
   - Clear itself after a failed attempt.
   - Show the lockout message from the server.
   - Keep icons from overlapping the text (leave room for them with padding).
6. Never store the passcode or tokens in localStorage beyond what the session library handles.

## 5. Shared-data rules

- Never trust values sent from the browser for ownership, roles, or prices. Derive them on the server.
- Show users generic error messages. Never display raw database error text.
- Do not reveal whether an account exists.
- Clean up anything unused: no dead files, no orphaned functions, no commented-out code.

## 6. Repository hygiene

- Keep the `.env` file out of version control (it must be in `.gitignore`).
- Connect the project to GitHub from the GitHub icon in the top-right corner of the builder so every change is backed up.

## 7. Definition of done

- The site builds and typechecks without errors.
- Every screen is reachable from the screen before it.
- Sign-in works with the correct passcode, rejects wrong ones, and locks out after repeated failures.
- Layouts are checked on phone and desktop widths.
- A short plain-language summary is given at the end of each change.

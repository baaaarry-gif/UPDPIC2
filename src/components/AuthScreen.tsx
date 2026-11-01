import { useState, type FormEvent } from "react";
import { Heart, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function AuthScreen() {
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const envUrl = import.meta.env.VITE_SUPABASE_URL;
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!envUrl || !envKey) {
      setError(
        "App configuration is missing. If this is a Vercel deployment, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as environment variables in Vercel, then redeploy."
      );
      setBusy(false);
      return;
    }
    try {
      const url = `${envUrl}/functions/v1/passcode-login`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${envKey}`,
        },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? "That passcode didn't match.");
        setPasscode("");
        setBusy(false);
        return;
      }
      const { error: sessErr } = await supabase.auth.setSession({
        access_token: json.access_token,
        refresh_token: json.refresh_token,
      });
      if (sessErr) setError("Could not start your session. Please try again.");
    } catch {
      setError("Network problem — please check your connection.");
    }
    setBusy(false);
  };

  return (
    <div className="app-bg min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-pink-300/80 text-xs uppercase tracking-[0.2em]">
            <Heart className="h-3.5 w-3.5" />
            Our Untold Story
          </div>
          <h1 className="mt-3 font-serif text-4xl text-white">Our Untold Story</h1>
          <p className="mt-2 text-sm text-white/50">
            Enter your passcode to continue.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="mt-8 rounded-3xl border border-white/10 bg-[#0a0a12]/80 p-6 backdrop-blur space-y-4"
        >
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-white/40 mb-1.5">
              Passcode
            </span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                type={showPasscode ? "text" : "password"}
                required
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="input has-leading-icon has-trailing-icon"
                placeholder="Enter your passcode"
              />
              <button
                type="button"
                onClick={() => setShowPasscode((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/40 transition hover:text-white"
                aria-label={showPasscode ? "Hide passcode" : "Show passcode"}
              >
                {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-white/35">
              Masked for your privacy. Too many wrong attempts pause sign-in for 15 minutes.
            </p>
          </label>

          {error && (
            <p className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-pink-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-pink-400 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}

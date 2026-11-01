
import { useState, type FormEvent } from "react";
import { Heart, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function AuthScreen() {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const fn = mode === "signin" ? signIn : signUp;
    const result = await fn(email.trim(), password);

    setBusy(false);

    if (result.error) {
      setError(result.error);
    } else if (mode === "signup") {
      setError("Account created successfully. You can now sign in.");
      setMode("signin");
      setPassword("");
    }
  };

  return (
    <div className="app-bg min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-pink-300/80 text-xs uppercase tracking-[0.2em]">
            <Heart className="h-3.5 w-3.5" />
            Our Untold Story
          </div>

          <h1 className="mt-3 font-serif text-4xl text-white">
            Our Untold Story
          </h1>

          <p className="mt-2 text-sm text-white/50">
            Sign in to keep your story with you, wherever you open it.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="mt-8 rounded-3xl border border-white/10 bg-[#0a0a12]/80 p-6 backdrop-blur space-y-4"
        >
          <div className="flex rounded-full border border-white/10 p-1 text-sm">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
              className={`flex-1 rounded-full py-1.5 transition ${
                mode === "signin"
                  ? "bg-pink-500/90 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Sign in
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`flex-1 rounded-full py-1.5 transition ${
                mode === "signup"
                  ? "bg-pink-500/90 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Create account
            </button>
          </div>

          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-white/40 mb-1.5">
              Email
            </span>

            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-white/40 mb-1.5">
              Password
            </span>

            <input
              type="password"
              required
              minLength={6}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="At least 6 characters"
            />
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
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <p className="text-center text-[11px] text-white/35 leading-relaxed">
            Your dates and memories are tied to your private account.
          </p>
        </form>
      </div>
    </div>
  );
}

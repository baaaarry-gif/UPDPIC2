import { useMemo } from "react";
import { Clock, Heart, LogOut, Loader2, Download, X } from "lucide-react";
import { useNow } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { useStoryData } from "@/lib/useStoryData";
import { CounterPanel } from "@/components/CounterPanel";
import { MemoryTimeline, type Memory } from "@/components/MemoryTimeline";
import { SettingsPanel } from "@/components/SettingsPanel";
import { AuthScreen } from "@/components/AuthScreen";
import { formatClock, formatLongDate, pad2 } from "@/lib/dates";

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const now = useNow(1000);

  if (authLoading) {
    return (
      <div className="app-bg min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-pink-300" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return <Story user={user} now={now} onSignOut={signOut} />;
}

function Story({
  user,
  now,
  onSignOut,
}: {
  user: { id: string; email?: string };
  now: Date;
  onSignOut: () => void;
}) {
  const {
    anniversary,
    lastSeen,
    privacy,
    memories,
    loading,
    setAnniversary,
    setLastSeen,
    setPrivacy,
    setMemories,
    resetAll,
    hasLocalData,
    importLocal,
    dismissLocal,
    uploadMemoryPhoto,
    removeMemoryPhoto,
  } = useStoryData(user.id);

  const anniversaryDate = useMemo(() => new Date(anniversary), [anniversary]);
  const lastSeenDate = useMemo(() => new Date(lastSeen), [lastSeen]);

  const anniversaryValid =
    !isNaN(anniversaryDate.getTime()) && anniversaryDate <= now;
  const lastSeenValid =
    !isNaN(lastSeenDate.getTime()) && lastSeenDate <= now;

  return (
    <div className="app-bg min-h-screen text-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-pink-300/80 text-xs uppercase tracking-[0.2em]">
              <Heart className="h-3.5 w-3.5" />
              Our Untold Story
            </div>
            <h1 className="mt-2 font-serif text-4xl sm:text-6xl leading-tight tracking-tight">
              Our Untold Story
            </h1>
            <p className="mt-2 text-sm sm:text-base text-white/50 max-w-md">
              A quiet place that counts every moment since the day everything
              began.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SettingsPanel
              anniversary={anniversary}
              lastSeen={lastSeen}
              privacy={privacy}
              onAnniversary={setAnniversary}
              onLastSeen={setLastSeen}
              onPrivacy={setPrivacy}
              onReset={resetAll}
            />
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-pink-400/40 hover:text-white"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        {hasLocalData && (
          <div className="mt-5 rounded-2xl border border-pink-400/30 bg-pink-500/10 p-4 sm:p-5 animate-fade-up">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <Download className="h-5 w-5 text-pink-300 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm text-white">
                    We found memories saved earlier in this browser.
                  </p>
                  <p className="mt-0.5 text-xs text-white/55">
                    Import them into your account so they travel with you to
                    every browser.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissLocal}
                className="shrink-0 rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={importLocal}
                className="inline-flex items-center gap-1.5 rounded-full bg-pink-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-400"
              >
                <Download className="h-4 w-4" /> Import into my account
              </button>
              <button
                type="button"
                onClick={dismissLocal}
                className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:text-white"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {/* Live clock */}
        <div className="mt-6 flex items-center justify-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-pink-400 live-dot" />
            <Clock className="h-4 w-4 text-white/50" />
            <span className="font-serif text-lg sm:text-xl tabular-nums tracking-wider">
              {formatClock(now)}
            </span>
            <span className="text-xs text-white/40 hidden sm:inline">
              {now.toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="mt-16 flex items-center justify-center text-white/40">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading your
            story…
          </div>
        ) : (
          <>
            <div
              className={privacy ? "pointer-events-none select-none blur-lg" : ""}
            >
              <div className="mt-8">
                {anniversaryValid ? (
                  <CounterPanel
                    title="Since Day One"
                    subtitle={`From ${formatLongDate(anniversaryDate)} — and still counting.`}
                    start={anniversaryDate}
                    now={now}
                    accent="pink"
                  />
                ) : (
                  <InvalidDate
                    label="Anniversary date"
                    hint="Set a valid date in the past in Settings."
                  />
                )}
              </div>

              <div className="mt-5">
                {lastSeenValid ? (
                  <CounterPanel
                    title="Last Sighting"
                    subtitle={`Since ${formatLongDate(lastSeenDate)}.`}
                    start={lastSeenDate}
                    now={now}
                    accent="blue"
                  />
                ) : (
                  <InvalidDate
                    label="Last sighting date"
                    hint="Set a valid date in the past in Settings."
                  />
                )}
              </div>
            </div>

            <div className="mt-5">
              <MemoryTimeline
                memories={memories}
                onChange={setMemories}
                anniversary={anniversaryDate}
                uploadPhoto={uploadMemoryPhoto}
                removePhoto={removeMemoryPhoto}
              />
            </div>
          </>
        )}

        <footer className="mt-10 text-center text-xs text-white/30 space-y-1">
          <p>Signed in as {user.email ?? "you"} · saved to your private account</p>
          <p className="max-w-md mx-auto leading-relaxed">
            Your dates and memories now live with your account, so they appear
            on any browser you sign in from — and only you can see them.
          </p>
          <p className="text-white/25">
            {pad2(now.getHours())}:{pad2(now.getMinutes())}
          </p>
        </footer>
      </div>
    </div>
  );
}

function InvalidDate({ label, hint }: { label: string; hint: string }) {
  return (
    <section className="rounded-3xl border border-amber-400/20 bg-amber-500/5 p-6 text-center">
      <p className="font-serif text-xl text-white">{label} is not set</p>
      <p className="mt-1 text-sm text-white/50">{hint}</p>
    </section>
  );
}

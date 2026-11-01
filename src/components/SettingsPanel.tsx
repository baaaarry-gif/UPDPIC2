import { useState } from "react";
import { Settings as SettingsIcon, X, RotateCcw } from "lucide-react";
import { parseDateInput, toDateTimeInputValue } from "@/lib/dates";

interface SettingsPanelProps {
  anniversary: string; // ISO
  lastSeen: string; // ISO
  privacy: boolean;
  onAnniversary: (iso: string) => void;
  onLastSeen: (iso: string) => void;
  onPrivacy: (v: boolean) => void;
  onReset: () => void;
}

export function SettingsPanel({
  anniversary,
  lastSeen,
  privacy,
  onAnniversary,
  onLastSeen,
  onPrivacy,
  onReset,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-pink-400/40 hover:text-white"
        aria-label="Open settings"
      >
        <SettingsIcon className="h-3.5 w-3.5" />
        Settings
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0d0d18] p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-xl text-white">Settings</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <Field label="Anniversary date (Day 1)" hint="When your story began.">
                <input
                  type="datetime-local"
                  value={toDateTimeInputValue(new Date(anniversary))}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    if (!isNaN(d.getTime())) onAnniversary(d.toISOString());
                  }}
                  className="input"
                />
              </Field>

              <Field
                label="Last sighting date"
                hint="The last time you saw them. Updates the sighting counter."
              >
                <input
                  type="datetime-local"
                  value={toDateTimeInputValue(new Date(lastSeen))}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    if (!isNaN(d.getTime())) onLastSeen(d.toISOString());
                  }}
                  className="input"
                />
              </Field>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={privacy}
                  onChange={(e) => onPrivacy(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-pink-500"
                />
                <span className="text-sm text-white/70">
                  <span className="block text-white">Private mode</span>
                  <span className="block text-white/45 text-xs mt-0.5">
                    Your data is always stored only on this device. This toggle
                    hides the counters from quick view for extra discretion.
                  </span>
                </span>
              </label>

              <div className="pt-3 border-t border-white/10">
                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-rose-300"
                  >
                    <RotateCcw className="h-4 w-4" /> Reset all data
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/60">Erase everything?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onReset();
                        setConfirmReset(false);
                        setOpen(false);
                      }}
                      className="rounded-full bg-rose-500/90 px-3 py-1 text-xs text-white hover:bg-rose-500"
                    >
                      Yes, erase
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[11px] leading-relaxed text-white/35">
                Your dates and memories are saved to your private account.
                Sign in on any browser to see them. Your passcode is never stored
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-white/40 mb-1.5">
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-white/35 mt-1">{hint}</span>}
    </label>
  );
}

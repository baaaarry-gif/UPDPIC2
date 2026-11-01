import { useCallback, useEffect, useState } from "react";
import { supabase, type MemoryRow, type UserSettings } from "@/lib/supabase";
import type { Memory } from "@/components/MemoryTimeline";

const DEFAULT_ANNIVERSARY = new Date("2022-04-19T00:00:00").toISOString();
const DEFAULT_LAST_SEEN = new Date("2026-03-05T00:00:00").toISOString();

const LS_KEYS = {
  anniversary: "ous.anniversary",
  lastSeen: "ous.lastSeen",
  privacy: "ous.privacy",
  memories: "ous.memories",
} as const;

interface LocalData {
  anniversary: string;
  lastSeen: string;
  privacy: boolean;
  memories: Memory[];
}

function readLocal(): LocalData | null {
  try {
    const a = localStorage.getItem(LS_KEYS.anniversary);
    const l = localStorage.getItem(LS_KEYS.lastSeen);
    const p = localStorage.getItem(LS_KEYS.privacy);
    const m = localStorage.getItem(LS_KEYS.memories);
    const hasCustom =
      (a && a !== JSON.stringify(DEFAULT_ANNIVERSARY)) ||
      (l && l !== JSON.stringify(DEFAULT_LAST_SEEN)) ||
      (m && m !== JSON.stringify([]));
    if (!hasCustom) return null;
    return {
      anniversary: a ? JSON.parse(a) : DEFAULT_ANNIVERSARY,
      lastSeen: l ? JSON.parse(l) : DEFAULT_LAST_SEEN,
      privacy: p ? JSON.parse(p) : false,
      memories: m ? JSON.parse(m) : [],
    };
  } catch {
    return null;
  }
}

function clearLocal() {
  try {
    Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export interface StoryData {
  anniversary: string;
  lastSeen: string;
  privacy: boolean;
  memories: Memory[];
  loading: boolean;
  hasLocalData: boolean;
  setAnniversary: (iso: string) => void;
  setLastSeen: (iso: string) => void;
  setPrivacy: (v: boolean) => void;
  setMemories: (m: Memory[]) => void;
  resetAll: () => void;
  importLocal: () => Promise<void>;
  dismissLocal: () => void;
  uploadMemoryPhoto: (file: File, memoryId: string) => Promise<{ path: string; url: string }>;
  removeMemoryPhoto: (path: string) => Promise<void>;
}

export function useStoryData(userId: string | undefined): StoryData {
  const [anniversary, setAnniversaryState] = useState(DEFAULT_ANNIVERSARY);
  const [lastSeen, setLastSeenState] = useState(DEFAULT_LAST_SEEN);
  const [privacy, setPrivacyState] = useState(false);
  const [memories, setMemoriesState] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLocalData, setHasLocalData] = useState(false);

  // Check for legacy browser-local data once.
  useEffect(() => {
    setHasLocalData(readLocal() !== null);
  }, []);

  // Load everything once the user is known.
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [settingsRes, memRes] = await Promise.all([
        supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("memories").select("*").order("date", { ascending: true }),
      ]);

      if (cancelled) return;

      if (settingsRes.data) {
        const s = settingsRes.data as UserSettings;
        setAnniversaryState(s.anniversary);
        setLastSeenState(s.last_seen);
        setPrivacyState(s.privacy);
      } else {
        // First login — seed a settings row with defaults.
        await supabase.from("user_settings").insert({
          user_id: userId,
          anniversary: DEFAULT_ANNIVERSARY,
          last_seen: DEFAULT_LAST_SEEN,
          privacy: false,
        });
      }

      if (memRes.data) {
        const loadedMemories = await Promise.all(
          (memRes.data as MemoryRow[]).map(async (row) => {
            const memory = rowToMemory(row);
            if (!memory.photoPath) return memory;
            const { data: signed } = await supabase.storage
              .from("memories")
              .createSignedUrl(memory.photoPath, 60 * 60);
            return { ...memory, photoUrl: signed?.signedUrl ?? null };
          })
        );
        setMemoriesState(loadedMemories);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setAnniversary = useCallback(
    (iso: string) => {
      setAnniversaryState(iso);
      if (userId) {
        supabase
          .from("user_settings")
          .upsert({ user_id: userId, anniversary: iso, last_seen: lastSeen, privacy, updated_at: new Date().toISOString() });
      }
    },
    [userId, lastSeen, privacy]
  );

  const setLastSeen = useCallback(
    (iso: string) => {
      setLastSeenState(iso);
      if (userId) {
        supabase
          .from("user_settings")
          .upsert({ user_id: userId, anniversary, last_seen: iso, privacy, updated_at: new Date().toISOString() });
      }
    },
    [userId, anniversary, privacy]
  );

  const setPrivacy = useCallback(
    (v: boolean) => {
      setPrivacyState(v);
      if (userId) {
        supabase
          .from("user_settings")
          .upsert({ user_id: userId, anniversary, last_seen: lastSeen, privacy: v, updated_at: new Date().toISOString() });
      }
    },
    [userId, anniversary, lastSeen]
  );

  const setMemories = useCallback(
    (next: Memory[]) => {
      setMemoriesState(next);
      if (!userId) return;
      // Simple sync: reconcile full list against DB.
      (async () => {
        const { data: existing } = await supabase
          .from("memories")
          .select("id, photo_path")
          .eq("user_id", userId);
        const existingRows = (existing ?? []) as Pick<MemoryRow, "id" | "photo_path">[];
        const existingIds = new Set(existingRows.map((r) => r.id));
        const nextIds = new Set(next.map((m) => m.id));

        const toInsert = next
          .filter((m) => !existingIds.has(m.id))
          .map(memoryToRow(userId));
        const toUpdate = next
          .filter((m) => existingIds.has(m.id))
          .map(memoryToRow(userId));
        const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
        const pathsToDelete = existingRows
          .filter((row) => toDelete.includes(row.id) && row.photo_path)
          .map((row) => row.photo_path as string);

        if (toInsert.length) await supabase.from("memories").insert(toInsert);
        if (toUpdate.length) {
          await Promise.all(
            toUpdate.map((row) =>
              supabase.from("memories").update(row).eq("id", row.id)
            )
          );
        }
        if (toDelete.length) {
          await supabase.from("memories").delete().in("id", toDelete);
          if (pathsToDelete.length) {
            await supabase.storage.from("memories").remove(pathsToDelete);
          }
        }
      })();
    },
    [userId]
  );

  const resetAll = useCallback(async () => {
    setAnniversaryState(DEFAULT_ANNIVERSARY);
    setLastSeenState(DEFAULT_LAST_SEEN);
    setPrivacyState(false);
    setMemoriesState([]);
    if (userId) {
      await supabase.from("memories").delete().eq("user_id", userId);
      await supabase
        .from("user_settings")
        .upsert({
          user_id: userId,
          anniversary: DEFAULT_ANNIVERSARY,
          last_seen: DEFAULT_LAST_SEEN,
          privacy: false,
          updated_at: new Date().toISOString(),
        });
    }
  }, [userId]);

  const importLocal = useCallback(async () => {
    const local = readLocal();
    if (!local || !userId) return;
    setAnniversaryState(local.anniversary);
    setLastSeenState(local.lastSeen);
    setPrivacyState(local.privacy);
    setMemoriesState(local.memories);
    await supabase.from("memories").delete().eq("user_id", userId);
    if (local.memories.length) {
      await supabase
        .from("memories")
        .insert(local.memories.map(memoryToRow(userId)));
    }
    await supabase
      .from("user_settings")
      .upsert({
        user_id: userId,
        anniversary: local.anniversary,
        last_seen: local.lastSeen,
        privacy: local.privacy,
        updated_at: new Date().toISOString(),
      });
    clearLocal();
    setHasLocalData(false);
  }, [userId]);

  const dismissLocal = useCallback(() => {
    clearLocal();
    setHasLocalData(false);
  }, []);

  const uploadMemoryPhoto = useCallback(
    async (file: File, memoryId: string) => {
      if (!userId) throw new Error("Not signed in");
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/${memoryId}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("memories")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data: signed, error: signedError } = await supabase.storage
        .from("memories")
        .createSignedUrl(path, 60 * 60);
      if (signedError || !signed?.signedUrl) throw signedError ?? new Error("Could not prepare photo");
      return { path, url: signed.signedUrl };
    },
    [userId]
  );

  const removeMemoryPhoto = useCallback(async (path: string) => {
    const { error } = await supabase.storage.from("memories").remove([path]);
    if (error) throw error;
  }, []);

  return {
    anniversary,
    lastSeen,
    privacy,
    memories,
    loading,
    hasLocalData,
    setAnniversary,
    setLastSeen,
    setPrivacy,
    setMemories,
    resetAll,
    importLocal,
    dismissLocal,
    uploadMemoryPhoto,
    removeMemoryPhoto,
  };
}

function rowToMemory(r: MemoryRow): Memory {
  return {
    id: r.id,
    date: r.date,
    title: r.title,
    notes: r.notes,
    milestone: r.milestone,
    photoPath: r.photo_path,
  };
}

function memoryToRow(userId: string) {
  return (m: Memory): MemoryRow => ({
    id: m.id,
    user_id: userId,
    date: m.date,
    title: m.title,
    notes: m.notes,
    milestone: !!m.milestone,
    photo_path: m.photoPath ?? null,
  });
}

// Player-photo upload helper (Build 9 — player card). One place that knows the
// bucket name + path convention so the form and any future caller can't drift.
// Path is {team_id}/{player_id}.{ext}; the storage RLS policy (migration 101)
// gates writes on the team_id folder segment. Bucket is public-read, so we store
// the public URL straight on team_players.photo_url.

import { supabase } from "@/lib/supabase/client";

export const PLAYER_PHOTO_BUCKET = "player-photos";

const ALLOWED = ["jpg", "jpeg", "png", "webp"];
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

type UploadResult = { url: string } | { error: string };

export async function uploadPlayerPhoto(args: {
  teamId: string;
  playerId: string;
  file: File;
}): Promise<UploadResult> {
  const { teamId, playerId, file } = args;
  if (file.size > MAX_PHOTO_BYTES) {
    return { error: "Photo must be under 5 MB." };
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  if (!ALLOWED.includes(ext)) {
    return { error: "Use a JPG, PNG, or WebP image." };
  }

  const path = `${teamId}/${playerId}.${ext}`;
  const { error } = await supabase.storage.from(PLAYER_PHOTO_BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type || undefined,
  });
  if (error) return { error: error.message };

  const { data } = supabase.storage.from(PLAYER_PHOTO_BUCKET).getPublicUrl(path);
  // Cache-bust so replacing a photo at the same path refreshes the <img>.
  return { url: `${data.publicUrl}?v=${Date.now()}` };
}

export type Provider = "spotify" | "youtube" | "audius";
export type PreviewType = "spotify_websdk" | "youtube_embed" | "audius_stream";

export interface FeedCard {
  track_id: string;
  provider: Provider;
  provider_track_id: string;
  title: string;
  artist: string;
  artwork_url?: string;
  preview: {
    type: PreviewType;
    url?: string;
    start_ms: number;
    duration_ms: number;
  };
  tags?: string[];
  reason?: string | null;
  meta?: {
    features?: {
      energy?: number;
      valence?: number;
      tempo?: number;
      instrumentalness?: number;
    };
    discovery_score?: number;
    clip_windows?: { label: "intro" | "hook" | "bridge"; start_ms: number; duration_ms: number }[];
    artist?: { id?: string; name?: string; genres?: string[]; popularity?: number };
  };
}

export interface FeedbackPayload {
  user_id: string;
  session_id: string;
  track_id: string;
  event: "start" | "like" | "dislike" | "skip" | "save" | "complete" | "nudge";
  dwell_ms: number;
  key?: string;      // optional for bandit tweak
  dir?: number;      // optional for bandit tweak
}

export interface Playlist {
  id: string;
  user_id: string;
  name: string;
  kind: string;
  created_at?: string;
}

export interface Session {
  id: string;
  user_id: string;
  seed: any;
}

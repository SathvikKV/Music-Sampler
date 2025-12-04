// lib/api.ts
import type { FeedCard, FeedbackPayload, Playlist, Session } from "./types"

const API_BASE = "/api"
console.log("API_BASE =", API_BASE)

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  try {
    const res = await fetch(url, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`HTTP ${res.status} on ${url}: ${text || res.statusText}`)
    }

    // if backend returns no body
    if (res.status === 204) return {} as T

    return (await res.json()) as T
  } catch (err) {
    console.error("fetchAPI failed:", url, err)
    throw err instanceof Error ? err : new Error(String(err))
  }
}

/* ===== feed ===== */
export async function getFeed({
  user_id,
  session_id,
  cursor,
}: {
  user_id: string
  session_id: string
  cursor?: string
}): Promise<FeedCard[]> {
  const params = new URLSearchParams({ user_id, session_id })
  if (cursor) params.append("cursor", cursor)
  return fetchAPI<FeedCard[]>(`/feed?${params.toString()}`)
}

/* ===== feedback ===== */
export async function postFeedback(payload: FeedbackPayload): Promise<{ ok: boolean }> {
  try {
    await fetchAPI("/feedback", {
      method: "POST",
      body: JSON.stringify(payload),
    })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/* ===== playback ===== */
export async function getPlaybackToken(user_id: string): Promise<{ token: string }> {
  return fetchAPI<{ token: string }>(`/playback/token?user_id=${user_id}`)
}

/* ===== auth ===== */
export async function getAuthorizeUrl(user_id: string): Promise<{ authorize_url: string }> {
  return fetchAPI<{ authorize_url: string }>(`/auth/spotify/start?user_id=${user_id}`)
}

/* ===== sessions ===== */
export async function createSession(user_id: string, query: string): Promise<Session> {
  return fetchAPI<Session>("/sessions", {
    method: "POST",
    body: JSON.stringify({ user_id, query }),
  })
}

export async function branchSession(
  user_id: string,
  from_session_id: string,
  provider_track_id: string,
): Promise<Session> {
  return fetchAPI<Session>("/sessions/branch", {
    method: "POST",
    body: JSON.stringify({ user_id, from_session_id, provider_track_id }),
  })
}

/* ===== playlists ===== */

// list playlists for a user
export async function getPlaylists(user_id: string): Promise<Playlist[]> {
  return fetchAPI<Playlist[]>(`/playlists?user_id=${user_id}`)
}

// get ONE playlist (with tracks)
export async function getPlaylist(playlist_id: string): Promise<Playlist & { tracks: any[] }> {
  return fetchAPI<Playlist & { tracks: any[] }>(`/playlists/${playlist_id}`)
}

// create playlist (backend gives id/name/kind)
export async function createPlaylist(user_id: string, name: string): Promise<Playlist> {
  return fetchAPI<Playlist>("/playlists", {
    method: "POST",
    body: JSON.stringify({ user_id, name }),
  })
}

// helper: get or create a "Liked" playlist for this user
export async function ensureLikedPlaylist(user_id: string): Promise<Playlist> {
  const lists = await getPlaylists(user_id)
  const existing =
    (lists as any[]).find((p) => p.name?.toLowerCase?.() === "liked") ||
    (lists as any[]).find((p) => (p as any).kind === "liked")
  if (existing) return existing as Playlist
  return createPlaylist(user_id, "Liked")
}

// add a track to playlist
export async function addTrackToPlaylist(opts: {
  playlist_id: string
  provider: string
  provider_track_id: string
  title?: string
  artist?: string
  artwork_url?: string
}): Promise<{ ok: boolean }> {
  const { playlist_id, provider, provider_track_id, title, artist, artwork_url } = opts

  // backend wants a plain track_id too
  // e.g. "spotify:track:44o..." -> "44o..."
  const track_id = provider_track_id.includes(":")
    ? provider_track_id.split(":").pop()!
    : provider_track_id

  await fetchAPI(`/playlists/${playlist_id}/tracks`, {
    method: "POST",
    body: JSON.stringify({
      track_id,             // <-- REQUIRED by backend
      provider,
      provider_track_id,
      title,
      artist,
      artwork_url,
    }),
  })

  return { ok: true }
}

/* this is the name your page is calling */
export async function getPlaylistWithTracks(id: string): Promise<Playlist & { tracks: any[] }> {
  return fetchAPI<Playlist & { tracks: any[] }>(`/playlists/${id}`)
}

/* delete track from playlist (only if backend route exists) */
export async function removeTrackFromPlaylist(playlist_id: string, track_id: string): Promise<{ ok: boolean }> {
  await fetchAPI(`/playlists/${playlist_id}/tracks/${track_id}`, {
    method: "DELETE",
  })
  return { ok: true }
}

/* ===== explain ===== */
export async function explainTrack(provider: string, provider_track_id: string) {
  return fetchAPI<{
    summary: string
    vibe?: string
    best_for?: string[]
    because?: string[]
    raw_features?: any
    artist_context?: string
  }>("/explain/track", {
    method: "POST",
    body: JSON.stringify({
      provider,
      track_id: provider_track_id,
    }),
  })
}

/* ===== explain playlist ===== */
export async function explainPlaylist(playlist_id: string) {
  return fetchAPI<{
    vibe: string
    genres: string[]
    consistency: number
    best_for: string[]
    analysis: string
  }>(`/explain/playlist/${playlist_id}`, {
    method: "POST",
  })
}

/* ===== health ===== */
export async function healthCheck(): Promise<{ ok: boolean }> {
  return fetchAPI<{ ok: boolean }>("/healthz")
}

import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query"
import {
  getFeed,
  postFeedback,
  getPlaybackToken,
  getPlaylists,
  createPlaylist,
  addTrackToPlaylist,
} from "@/lib/api"
import type { FeedbackPayload, FeedCard, Playlist } from "@/lib/types"

export function useFeedQuery(userId: string, sessionId: string) {
  return useInfiniteQuery<FeedCard[]>({
    queryKey: ["feed", userId, sessionId],
    queryFn: async () => getFeed({ user_id: userId, session_id: sessionId }),
    initialPageParam: undefined,
    getNextPageParam: () => undefined, // <- no more pagination until backend supports it
    enabled: !!userId && !!sessionId,
  })
}

export function useFeedbackMutation() {
  return useMutation({
    mutationFn: (payload: FeedbackPayload) => postFeedback(payload),
  })
}

export function usePlaybackToken(userId: string) {
  return useQuery({
    queryKey: ["playback-token", userId],
    queryFn: () => getPlaybackToken(userId),
    staleTime: 50 * 60 * 1000,
    enabled: !!userId,
  })
}

export function usePlaylistsQuery(userId: string) {
  return useQuery<Playlist[]>({
    queryKey: ["playlists", userId],
    queryFn: () => getPlaylists(userId),
    enabled: !!userId,
  })
}

export function useCreatePlaylistMutation() {
  return useMutation({
    mutationFn: ({
      userId,
      name,
      kind = "vibe",                 // <- default to a backend-accepted kind
    }: {
      userId: string
      name: string
      kind?: "vibe" | "genre"
    }) => createPlaylist(userId, name, kind),
  })
}

export function useAddTrackToPlaylistMutation() {
  return useMutation({
    mutationFn: ({ playlistId, trackId }: { playlistId: string; trackId: string }) =>
      addTrackToPlaylist(playlistId, trackId),
  })
}

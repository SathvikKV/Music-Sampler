// components/players/SpotifyPlayer.tsx
"use client"

import { useEffect, useRef } from "react"
import {
  initializeSpotifyPlayer,
  ensureAudioUnlocked,
  waitForDeviceRegistration,
  maybeTransferToThisDevice,
  transferAndPlay,
  pauseSpotify,
} from "@/lib/spotify"
import type { FeedCard } from "@/lib/types"

interface SpotifyPlayerProps {
  card: FeedCard
  active: boolean
  spotifyToken: string
  onStart: () => void
  onComplete: () => void
  onError: (error: Error) => void
}

export function SpotifyPlayer({
  card,
  active,
  spotifyToken,
  onStart,
  onComplete,
  onError,
}: SpotifyPlayerProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedRef = useRef(false)
  const lastUriRef = useRef<string | null>(null)
  const lastTokenRef = useRef<string | null>(null)

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    // card not active → stop/pause and clean up
    if (!active) {
      pauseSpotify().catch(() => {})
      clearTimer()
      startedRef.current = false
      return
    }

    const uri = card.provider_track_id
    if (!spotifyToken || !uri) {
      onError(new Error("Missing Spotify token or track URI"))
      return
    }

    const startMs = card.preview.start_ms ?? 0
    const durationMs = card.preview.duration_ms ?? 0

    const run = async () => {
      try {
        // 1) init SDK (idempotent)
        await initializeSpotifyPlayer(async () => spotifyToken)

        // 2) make sure audio is unlocked
        await ensureAudioUnlocked()

        // 3) wait until Spotify actually lists our web player device
        await waitForDeviceRegistration()

        // 4) transfer to our device (debounced inside)
        await maybeTransferToThisDevice()

        // 5) only re-play if token or track changed
        const tokenChanged = lastTokenRef.current !== spotifyToken
        const uriChanged = lastUriRef.current !== uri
        if (tokenChanged || uriChanged) {
          await transferAndPlay({ uri, position_ms: startMs })
          lastTokenRef.current = spotifyToken
          lastUriRef.current = uri
          startedRef.current = false
        }

        // 6) fire onStart once
        if (!startedRef.current) {
          startedRef.current = true
          onStart()
        }

        // 7) schedule end-of-clip
        clearTimer()
        if (durationMs > 0) {
          timerRef.current = setTimeout(() => {
            pauseSpotify().catch(() => {})
            onComplete()
          }, durationMs)
        }
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)))
      }
    }

    run()

    return () => {
      // unmount / visibility change
      pauseSpotify().catch(() => {})
      clearTimer()
    }
  }, [
    active,
    spotifyToken,
    card.provider_track_id,
    card.preview.start_ms,
    card.preview.duration_ms,
    onStart,
    onComplete,
    onError,
  ])

  return null
}

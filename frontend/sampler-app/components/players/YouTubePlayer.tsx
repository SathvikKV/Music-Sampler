"use client"

import { useEffect, useRef } from "react"
import type { FeedCard } from "@/lib/types"

interface YouTubePlayerProps {
  card: FeedCard
  active: boolean
  onStart: () => void
  onComplete: () => void
  onError: (error: Error) => void
}

/**
 * Minimal YT typings so we don't depend on external type packages.
 */
type YTPlayerState = -1 | 0 | 1 | 2 | 3 | 5; // unstarted= -1, ended=0, playing=1, paused=2, buffering=3, cued=5
interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  loadVideoById: (videoId: string) => void
  mute: () => void
  destroy: () => void
}
interface YTNS {
  Player: new (
    element: HTMLElement,
    opts: {
      height?: string | number
      width?: string | number
      videoId: string
      playerVars?: Record<string, any>
      events?: {
        onReady?: (e: { target: YTPlayer }) => void
        onStateChange?: (e: { data: YTPlayerState; target: YTPlayer }) => void
        onError?: (e: unknown) => void
      }
    }
  ) => YTPlayer
}
declare global {
  interface Window {
    YT?: YTNS
    onYouTubeIframeAPIReady?: () => void
  }
}

/** Lazily load the YouTube IFrame API once */
let ytPromise: Promise<void> | null = null
function loadYouTubeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (ytPromise) return ytPromise

  ytPromise = new Promise<void>((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve()
      return
    }
    window.onYouTubeIframeAPIReady = () => resolve()
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      document.head.appendChild(tag)
    }
  })
  return ytPromise
}

export function YouTubePlayer({ card, active, onStart, onComplete, onError }: YouTubePlayerProps) {
  const playerRef = useRef<YTPlayer | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedRef = useRef(false)
  const lastVideoIdRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const stopAndCleanup = () => {
      clearTimer()
      try {
        playerRef.current?.pauseVideo()
      } catch {}
    }

    if (!active) {
      stopAndCleanup()
      return
    }

    const startMs = card.preview.start_ms ?? 0
    const durationMs = card.preview.duration_ms ?? 0
    const videoId = card.provider_track_id

    const startPlaybackWindow = (player: YTPlayer) => {
      try {
        // For autoplay reliability, mute first (common browser policy requirement)
        player.mute()
        player.seekTo(startMs / 1000, true)
        player.playVideo()

        if (!startedRef.current) {
          startedRef.current = true
          onStart()
        }

        clearTimer()
        if (durationMs > 0) {
          timerRef.current = setTimeout(() => {
            player.pauseVideo()
            onComplete()
          }, durationMs)
        }
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)))
      }
    }

    const init = async () => {
      try {
        await loadYouTubeAPI()
        if (cancelled || !containerRef.current) return

        // Create or reuse player
        if (!playerRef.current) {
          startedRef.current = false
          lastVideoIdRef.current = videoId
          playerRef.current = new window.YT!.Player(containerRef.current, {
            height: "0",
            width: "0",
            videoId,
            playerVars: {
              autoplay: 1,
              controls: 0,
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
            },
            events: {
              onReady: (e) => {
                if (cancelled) return
                startPlaybackWindow(e.target)
              },
              onStateChange: (e) => {
                // If the native video ends earlier than our window timer, complete early
                if (e.data === 0 /* ENDED */) {
                  clearTimer()
                  onComplete()
                }
              },
              onError: () => {
                onError(new Error("YouTube player error"))
              },
            },
          })
        } else {
          // If switching to a different video id, load it
          if (lastVideoIdRef.current !== videoId) {
            startedRef.current = false
            lastVideoIdRef.current = videoId
            playerRef.current.loadVideoById(videoId)
          }
          startPlaybackWindow(playerRef.current)
        }
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)))
      }
    }

    init()

    // Cleanup when effect deps change/unmount
    return () => {
      cancelled = true
      clearTimer()
      // Do not destroy the player on every toggle; keep instance for reuse on same card
      // If you want to fully destroy on unmount, uncomment below:
      // playerRef.current?.destroy()
      // playerRef.current = null
    }
  }, [active, card.provider_track_id, card.preview.start_ms, card.preview.duration_ms, onStart, onComplete, onError])

  // Hidden container for the iframe
  return <div ref={containerRef} style={{ width: 0, height: 0, overflow: "hidden" }} />
}

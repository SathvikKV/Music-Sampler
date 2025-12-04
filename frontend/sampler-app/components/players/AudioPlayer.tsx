"use client"

import { useEffect, useRef } from "react"
import type { FeedCard } from "@/lib/types"

interface AudioPlayerProps {
  card: FeedCard
  active: boolean
  onStart: () => void
  onComplete: () => void
  onError: (error: Error) => void
}

export function AudioPlayer({ card, active, onStart, onComplete, onError }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedRef = useRef(false)
  const urlRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!card.preview.url) {
      onError(new Error("No audio URL provided"))
      return
    }

    // Recreate the Audio element if URL changes
    if (!audioRef.current || urlRef.current !== card.preview.url) {
      audioRef.current?.pause()
      audioRef.current = new Audio(card.preview.url)
      audioRef.current.preload = "auto"
      urlRef.current = card.preview.url
      startedRef.current = false
    }

    const audio = audioRef.current

    // Helper cleanup
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const handleEnded = () => {
      // If the underlying media ends before our window timer, treat as complete
      clearTimer()
      onComplete()
    }

    // When not active: pause and cleanup timers/listeners
    if (!active) {
      audio.pause()
      clearTimer()
      audio.removeEventListener("ended", handleEnded)
      return
    }

    // Active: prepare to play a clipped window
    const startMs = card.preview.start_ms ?? 0
    const durationMs = card.preview.duration_ms ?? 0

    const startPlayback = async () => {
      try {
        // Ensure metadata is available to compute safe seek
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          const safeStart = Math.min(startMs / 1000, Math.max(0, audio.duration - 0.05)) // avoid edge
          audio.currentTime = safeStart
        } else {
          // If duration unknown yet, set currentTime optimistically; some browsers allow it pre-metadata
          audio.currentTime = startMs / 1000
        }

        // Avoid double onStart if this effect re-runs
        if (!startedRef.current) {
          await audio.play()
          startedRef.current = true
          onStart()

          // Windowed complete callback
          clearTimer()
          if (durationMs > 0) {
            timerRef.current = setTimeout(() => {
              audio.pause()
              onComplete()
            }, durationMs)
          }
        }
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)))
      }
    }

    const onReady = () => {
      // Some browsers prefer canplaythrough, others already ready
      startPlayback()
    }

    // Wire listeners and kick off
    audio.addEventListener("ended", handleEnded)
    if (audio.readyState >= 3) {
      // HAVE_FUTURE_DATA
      startPlayback()
    } else {
      audio.addEventListener("canplaythrough", onReady, { once: true })
      // Fallback if canplaythrough never fires
      audio.addEventListener("canplay", onReady, { once: true })
      // As a last resort, try after a short delay
      const t = setTimeout(onReady, 1000)
      timerRef.current = t as unknown as ReturnType<typeof setTimeout>
    }

    return () => {
      audio.pause()
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("canplaythrough", onReady as any)
      audio.removeEventListener("canplay", onReady as any)
      clearTimer()
      // Do not null out audioRef; we keep it to allow quick resume when card stays the same
    }
  }, [card.preview.url, card.preview.start_ms, card.preview.duration_ms, active, onStart, onComplete, onError])

  return null
}

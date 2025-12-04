"use client"

import { useState, useEffect, useRef } from "react"
import { Heart, ThumbsDown, ListMusic, Sparkles, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PlayerManager } from "./PlayerManager"
import { DwellTimer } from "@/lib/analytics"
import { formatTimeLeft } from "@/lib/time"
import { useIntersection } from "@/hooks/use-intersection"
import { cn } from "@/lib/utils"
import { AddToPlaylistDialog } from "./AddToPlaylistDialog"
import type { FeedCard as FeedCardType, Playlist } from "@/lib/types"

interface FeedCardProps {
  card: FeedCardType
  spotifyToken?: string
  onStart?: (trackId: string, dwellMs: number) => void
  onLike: (trackId: string, dwellMs: number) => void
  onDislike: (trackId: string, dwellMs: number) => void
  onSave: (trackId: string, dwellMs: number) => void
  onComplete: (trackId: string, dwellMs: number) => void
  onSkip: (trackId: string, dwellMs: number) => void
  onMoreLikeThis?: (card: FeedCardType) => void
  onAdvanceNext?: () => void
  onAddToPlaylist?: (trackId: string, playlist: Playlist) => void
}

// richer type for the analyze modal
type ExplainData = {
  summary?: string
  vibe?: string
  best_for?: string[]
  because?: string[]
  bpm?: number
  // new fields from backend
  lyric_themes?: string[]
  mood?: string[]
  sonic_notes?: string[]
  energy?: number
  valence?: number
  artist_context?: string
}

export function FeedCard({
  card,
  spotifyToken,
  onStart,
  onLike,
  onDislike,
  onSave,
  onComplete,
  onSkip,
  onMoreLikeThis,
  onAdvanceNext,
  onAddToPlaylist,
}: FeedCardProps) {
  const { ref, isIntersecting } = useIntersection(0.7)
  const dwellTimerRef = useRef(new DwellTimer())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // use full song duration if backend sent it, else fall back to 30s
  const durationMs = card.preview?.duration_ms ?? 30000

  const [isPlaying, setIsPlaying] = useState(false)
  const [timeLeft, setTimeLeft] = useState(durationMs)
  const [liked, setLiked] = useState(false)

  // analyze state
  const [showExplain, setShowExplain] = useState(false)
  const [explainLoading, setExplainLoading] = useState(false)
  const [explainError, setExplainError] = useState<string | null>(null)
  const [explainData, setExplainData] = useState<ExplainData | null>(null)

  // feature helpers
  const hasFeatures = !!card.meta?.features
  const energy = card.meta?.features?.energy ?? 0
  const valence = card.meta?.features?.valence ?? 0
  const tempo = card.meta?.features?.tempo ?? 0
  const discovery = card.meta?.discovery_score

  // visibility logic
  useEffect(() => {
    if (isIntersecting) {
      dwellTimerRef.current.start()
    } else {
      if (isPlaying) {
        const dwellMs = dwellTimerRef.current.getDwellMs()
        onSkip(card.track_id, dwellMs)
      }
      dwellTimerRef.current.reset()
      setIsPlaying(false)
      setTimeLeft(durationMs)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isIntersecting, card.track_id, isPlaying, onSkip, durationMs])

  const handleStart = () => {
    setIsPlaying(true)
    const startDwell = dwellTimerRef.current.getDwellMs()
    onStart?.(card.track_id, startDwell)

    const startedAt = Date.now()
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt
      const remaining = Math.max(0, durationMs - elapsed)
      setTimeLeft(remaining)
      if (remaining === 0 && intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }, 200)
  }

  const handleComplete = () => {
    setIsPlaying(false)
    const dwellMs = dwellTimerRef.current.getDwellMs()
    onComplete(card.track_id, dwellMs)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    onAdvanceNext?.()
  }

  const handleError = (error: Error) => {
    console.error("Player error:", error)
    setIsPlaying(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const handleLike = () => {
    setLiked(true)
    const dwellMs = dwellTimerRef.current.getDwellMs()
    onLike(card.track_id, dwellMs)
    onAdvanceNext?.()
  }

  const handleDislike = () => {
    const dwellMs = dwellTimerRef.current.getDwellMs()
    onDislike(card.track_id, dwellMs)
    onAdvanceNext?.()
  }

  const handleSave = () => {
    const dwellMs = dwellTimerRef.current.getDwellMs()
    onSave(card.track_id, dwellMs)
  }

  const handlePlaylistSelection = (playlist: Playlist) => {
    const dwellMs = dwellTimerRef.current.getDwellMs()
    onSave(card.track_id, dwellMs)
    onAddToPlaylist?.(card.track_id, playlist)
  }

  // Analyze handler
  const handleAnalyze = async () => {
    // normalize track id
    const normalizedTrackId =
      card.provider_track_id ??
      (card.provider === "spotify" ? `spotify:track:${card.track_id}` : card.track_id)

    if (!normalizedTrackId) {
      setExplainError("No Spotify track id on this card.")
      setShowExplain(true)
      return
    }

    setExplainLoading(true)
    setExplainError(null)
    setShowExplain(true)

    try {
      const res = await fetch("/api/explain/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: card.provider ?? "spotify",
          track_id: normalizedTrackId,
          // Pass lyrics if available
          lyrics: (card.meta as any)?.lyrics ?? null,
        }),
      })

      const data = await res.json()
      console.log("Explain response:", data)

      if (!res.ok) {
        setExplainError(data?.detail || "Could not analyze this track.")
        setExplainData(null)
        return
      }

      if (!data?.explanation) {
        setExplainError("No analysis data returned.")
        setExplainData(null)
        return
      }

      const feats = data.raw?.audio_features || {}
      const explain = data.explanation

      setExplainData({
        summary: explain.summary || "No summary available.",
        vibe: explain.vibe,
        best_for: explain.best_for || [],
        because: explain.because || [],
        lyric_themes: explain.lyric_themes || [],
        mood: explain.mood || [],
        sonic_notes: explain.sonic_notes || [],
        bpm: feats.tempo ?? card.meta?.features?.tempo,
        energy: feats.energy ?? card.meta?.features?.energy,
        valence: feats.valence ?? card.meta?.features?.valence,
        artist_context: explain.artist_context,
      })

      setExplainError(null)
    } catch (err) {
      console.error("Explain track failed:", err)
      setExplainError("Something went wrong while analyzing this track.")
      setExplainData(null)
    } finally {
      setExplainLoading(false)
    }
  }

  const progressPct = durationMs > 0 ? ((durationMs - timeLeft) / durationMs) * 100 : 0
  const displayTime = formatTimeLeft(timeLeft)

  return (
    <>
      <div ref={ref} className="snap-start h-screen flex items-center justify-center p-4">
        <Card className="relative w-full max-w-md aspect-[9/16] overflow-hidden bg-card/50 backdrop-blur-md border-muted">
          <div
            className="absolute inset-0 bg-cover bg-center blur-2xl opacity-30"
            style={{
              backgroundImage: card.artwork_url
                ? `url(${card.artwork_url})`
                : "linear-gradient(135deg, var(--brand) 0%, var(--accent) 100%)",
            }}
          />

          <div className="relative h-full flex flex-col justify-between p-6">
            {/* Top badges */}
            <div className="space-y-3">
              {card.reason && (
                <Badge variant="secondary" className="bg-brand/20 text-brand-foreground">
                  {card.reason}
                </Badge>
              )}

              {(card.meta?.artist?.name || discovery !== undefined) && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="truncate">
                    {card.meta?.artist?.name && (
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        {card.meta.artist.name}
                      </span>
                    )}
                  </div>
                  {discovery !== undefined && (
                    <span className="ml-2 shrink-0">Discovery {discovery}</span>
                  )}
                </div>
              )}
            </div>

            {/* Center artwork */}
            <div className="flex-1 flex items-center justify-center">
              <div className="relative">
                {card.artwork_url ? (
                  <img
                    src={card.artwork_url || "/placeholder.svg"}
                    alt={card.title}
                    className="w-64 h-64 rounded-2xl shadow-2xl"
                  />
                ) : (
                  <div className="w-64 h-64 rounded-2xl bg-gradient-to-br from-brand to-accent shadow-2xl" />
                )}
              </div>
            </div>

            {/* Bottom content */}
            <div className="space-y-4">
              {/* Title / artist / tags */}
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold text-foreground text-balance">{card.title}</h2>
                <p className="text-lg text-muted-foreground">{card.artist}</p>
                {card.tags && card.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {card.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Vibe meters */}
              {hasFeatures && (
                <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="flex justify-between">
                      <span>Energy</span>
                      <span>{Math.round((energy ?? 0) * 100)}</span>
                    </div>
                    <div className="h-1 bg-muted rounded">
                      <div className="h-1 rounded bg-primary" style={{ width: `${(energy ?? 0) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span>Valence</span>
                      <span>{Math.round((valence ?? 0) * 100)}</span>
                    </div>
                    <div className="h-1 bg-muted rounded">
                      <div className="h-1 rounded bg-primary" style={{ width: `${(valence ?? 0) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span>BPM</span>
                      <span>{Math.round(tempo || 0)}</span>
                    </div>
                    <div className="h-1 bg-muted rounded">
                      <div
                        className="h-1 rounded bg-primary"
                        style={{ width: `${Math.min(1, (tempo || 0) / 200) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Progress */}
              <div className="space-y-2">
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand transition-all duration-100 ease-linear"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>{isPlaying ? "Playing" : "Ready"}</span>
                  <Badge variant="secondary" className="text-xs">
                    {displayTime}
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-2 flex items-center gap-3">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleDislike}
                  className="h-12 w-12 rounded-full hover:bg-destructive/20"
                  title="Dislike"
                >
                  <ThumbsDown className="h-5 w-5" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-14 w-14 rounded-full",
                    liked ? "bg-brand text-brand-foreground" : "hover:bg-brand/20",
                  )}
                  onClick={handleLike}
                  title="Like"
                >
                  <Heart className={cn("h-6 w-6", liked && "fill-current")} />
                </Button>

                <AddToPlaylistDialog onAddToPlaylist={handlePlaylistSelection}>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-12 w-12 rounded-full hover:bg-accent/20"
                    title="Save to playlist"
                  >
                    <ListMusic className="h-5 w-5" />
                  </Button>
                </AddToPlaylistDialog>

                <div className="ml-auto">
                  <Button variant="outline" size="sm" onClick={handleAnalyze} className="gap-1">
                    <Info className="h-4 w-4" />
                    Analyze
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Player Manager */}
          <PlayerManager
            card={card}
            active={isIntersecting}
            spotifyToken={spotifyToken}
            onStart={handleStart}
            onComplete={handleComplete}
            onError={handleError}
          />
        </Card>
      </div>

      {/* Analyze modal */}
      {showExplain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-background rounded-2xl shadow-xl max-w-lg w-full p-5 space-y-2 relative">
            <button
              onClick={() => setShowExplain(false)}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
            <h3 className="text-lg font-semibold mb-1">Track breakdown</h3>

            {explainLoading && <p className="text-sm text-muted-foreground">Analyzing…</p>}

            {!explainLoading && explainError && (
              <p className="text-sm text-destructive">{explainError}</p>
            )}

            {!explainLoading && !explainError && explainData && (
              <div className="space-y-2 text-sm">
                <p>{explainData.summary}</p>

                {explainData.lyric_themes && explainData.lyric_themes.length > 0 && (
                  <p>
                    <span className="font-medium">Themes:</span>{" "}
                    {explainData.lyric_themes.join(", ")}
                  </p>
                )}

                {explainData.mood && explainData.mood.length > 0 && (
                  <p>
                    <span className="font-medium">Mood:</span> {explainData.mood.join(", ")}
                  </p>
                )}

                {explainData.sonic_notes && explainData.sonic_notes.length > 0 && (
                  <p>
                    <span className="font-medium">Sonic notes:</span>{" "}
                    {explainData.sonic_notes.join(", ")}
                  </p>
                )}

                {Array.isArray(explainData.best_for) && explainData.best_for.length > 0 && (
                  <p>
                    <span className="font-medium">Best for:</span>{" "}
                    {explainData.best_for.join(", ")}
                  </p>
                )}

                {Array.isArray(explainData.because) && explainData.because.length > 0 && (
                  <p className="text-muted-foreground">
                    Because: {explainData.because.join(", ")}
                  </p>
                )}

                {explainData.artist_context && (
                  <div className="pt-2 border-t border-border mt-2">
                    <p className="font-medium text-xs text-muted-foreground mb-1">Artist Context / News</p>
                    <p className="text-xs italic text-muted-foreground">{explainData.artist_context}</p>
                  </div>
                )}

                {(typeof explainData.bpm === "number" ||
                  typeof explainData.energy === "number" ||
                  typeof explainData.valence === "number") && (
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {typeof explainData.bpm === "number" && (
                        <span>BPM: {Math.round(explainData.bpm)}</span>
                      )}
                      {typeof explainData.energy === "number" && (
                        <span>Energy: {Math.round(explainData.energy * 100)}</span>
                      )}
                      {typeof explainData.valence === "number" && (
                        <span>Valence: {Math.round(explainData.valence * 100)}</span>
                      )}
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

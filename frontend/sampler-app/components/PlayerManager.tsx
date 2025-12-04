// components/PlayerManager.tsx
"use client"

import { SpotifyPlayer } from "./players/SpotifyPlayer"
import { YouTubePlayer } from "./players/YouTubePlayer"
import { AudioPlayer } from "./players/AudioPlayer"
import type { FeedCard } from "@/lib/types"

interface PlayerManagerProps {
  card: FeedCard
  active: boolean
  spotifyToken?: string
  onStart: () => void
  onComplete: () => void
  onError: (error: Error) => void
}

export function PlayerManager({ card, active, spotifyToken, onStart, onComplete, onError }: PlayerManagerProps) {
  if (card.preview.type === "spotify_websdk") {
    if (!spotifyToken) return null
    return (
      <SpotifyPlayer
        card={card}
        active={active}
        spotifyToken={spotifyToken}
        onStart={onStart}
        onComplete={onComplete}
        onError={onError}
      />
    )
  }

  if (card.preview.type === "youtube_embed") {
    return <YouTubePlayer card={card} active={active} onStart={onStart} onComplete={onComplete} onError={onError} />
  }

  if (card.preview.type === "audius_stream") {
    return <AudioPlayer card={card} active={active} onStart={onStart} onComplete={onComplete} onError={onError} />
  }

  return null
}

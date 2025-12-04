// app/feed/page.tsx
"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Header } from "@/components/Header"
import { FeedCard } from "@/components/FeedCard"
import {
  useFeedQuery,
  useFeedbackMutation,
  usePlaybackToken,
} from "@/hooks/use-feed"
import { useSessionStore } from "@/stores/useSessionStore"
import { useToast } from "@/hooks/use-toast"
import type { Playlist, FeedCard as FeedCardType } from "@/lib/types"
import {
  branchSession,
  ensureLikedPlaylist,
  addTrackToPlaylist,
  getPlaylists,
} from "@/lib/api"

export default function FeedPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id") || ""
  const userId = searchParams.get("user_id") || ""
  const { setSessionId, setUserId } = useSessionStore()
  const { toast } = useToast()
  const router = useRouter()

  // playlist state
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null)
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(null)
  const [likedPlaylistId, setLikedPlaylistId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useFeedQuery(userId, sessionId)
  const feedbackMutation = useFeedbackMutation()
  const { data: tokenData } = usePlaybackToken(userId)

  // attach user/session to store
  useEffect(() => {
    if (sessionId) setSessionId(sessionId)
    if (userId) setUserId(userId)
  }, [sessionId, userId, setSessionId, setUserId])

  // get or create "Liked" once we know the user
  useEffect(() => {
    if (!userId) return
      ; (async () => {
        try {
          // first try to find any playlist, then ensure liked
          await getPlaylists(userId)
          const liked = await ensureLikedPlaylist(userId)
          const pid = (liked as any).id || (liked as any).playlist_id
          setLikedPlaylistId(pid)
        } catch (err) {
          console.error("could not ensure liked playlist", err)
        }
      })()
  }, [userId])

  // Scroll to next card helper
  const scrollToNext = useCallback((currentIndex: number) => {
    const cards = containerRef.current?.querySelectorAll("[data-feed-card]")
    if (!cards || currentIndex >= cards.length - 1) return
    const next = cards[currentIndex + 1] as HTMLElement
    next?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [])

  // Infinite scroll observer
  useEffect(() => {
    if (!containerRef.current) return
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const lastEntry = entries[0]
        if (lastEntry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.8 },
    )
    const cards = containerRef.current.querySelectorAll("[data-feed-card]")
    const lastCard = cards[cards.length - 1]
    if (lastCard) observerRef.current.observe(lastCard)
    return () => observerRef.current?.disconnect()
  }, [data, hasNextPage, isFetchingNextPage, fetchNextPage])

  // if user picked a playlist from header AND we had a pending track, add it now
  useEffect(() => {
    if (selectedPlaylist && pendingTrackId) {
      ; (async () => {
        try {
          // we only have the plain track id here — you might need to pass the full card
          await addTrackToPlaylist({
            playlist_id: selectedPlaylist.id,
            provider: "spotify",
            provider_track_id: `spotify:track:${pendingTrackId}`,
          })
          toast({
            title: "Saved",
            description: `Added to "${selectedPlaylist.name}"`,
          })
        } catch (err) {
          toast({
            title: "Error",
            description: "Failed to add track",
            variant: "destructive",
          })
        } finally {
          setPendingTrackId(null)
        }
      })()
    }
  }, [selectedPlaylist, pendingTrackId, toast])

  const handleFeedback = (
    trackId: string,
    event: "start" | "like" | "dislike" | "skip" | "save" | "complete",
    dwellMs: number,
  ) => {
    if (!userId || !sessionId) return
    feedbackMutation.mutate({
      user_id: userId,
      session_id: sessionId,
      track_id: trackId,
      event,
      dwell_ms: dwellMs,
    })
  }

  const handleSelectPlaylist = (playlist: Playlist) => setSelectedPlaylist(playlist)

  const handleMoreLikeThis = async (card: FeedCardType) => {
    if (!userId || !sessionId) return
    try {
      const s = await branchSession(userId, sessionId, card.provider_track_id)
      router.push(`/feed?session_id=${s.id}&user_id=${userId}`)
    } catch (e) {
      toast({
        title: "Error",
        description: "Could not branch session",
        variant: "destructive",
      })
    }
  }

  const allCards = data?.pages.flat() || []

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onSelectPlaylist={handleSelectPlaylist} />
      <div
        ref={containerRef}
        className="snap-y snap-mandatory h-[calc(100vh-4rem)] overflow-y-auto pt-16"
      >
        {allCards.map((card, index) => (
          <div key={`${card.track_id}-${index}`} data-feed-card>
            <FeedCard
              card={card}
              spotifyToken={tokenData?.token ?? ""}
              onStart={(trackId, dwellMs) => handleFeedback(trackId, "start", dwellMs)}
              onLike={async (trackId, dwellMs) => {
                handleFeedback(trackId, "like", dwellMs)
                // also add to Liked if we have its id
                if (likedPlaylistId) {
                  const provider_track_id =
                    card.provider_track_id ?? `spotify:track:${card.track_id}`
                  await addTrackToPlaylist({
                    playlist_id: likedPlaylistId,
                    provider: card.provider ?? "spotify",
                    provider_track_id,
                    title: card.title,
                    artist: card.artist,
                    artwork_url: card.artwork_url,
                  })
                }
                scrollToNext(index)
              }}
              onDislike={(trackId, dwellMs) => {
                handleFeedback(trackId, "dislike", dwellMs)
                scrollToNext(index)
              }}
              onSave={(trackId, dwellMs) => {
                handleFeedback(trackId, "save", dwellMs)
              }}
              onAddToPlaylist={async (trackId, playlist) => {
                const provider_track_id =
                  card.provider_track_id ?? `spotify:track:${card.track_id}`
                try {
                  await addTrackToPlaylist({
                    playlist_id: playlist.id,
                    provider: card.provider ?? "spotify",
                    provider_track_id,
                    title: card.title,
                    artist: card.artist,
                    artwork_url: card.artwork_url,
                  })
                  toast({
                    title: "Saved",
                    description: `Added to "${playlist.name}"`,
                  })
                } catch (err) {
                  toast({
                    title: "Error",
                    description: "Failed to add track",
                    variant: "destructive",
                  })
                }
              }}
              onComplete={(trackId, dwellMs) =>
                handleFeedback(trackId, "complete", dwellMs)
              }
              onSkip={(trackId, dwellMs) => handleFeedback(trackId, "skip", dwellMs)}
              onMoreLikeThis={handleMoreLikeThis}
              onAdvanceNext={() => scrollToNext(index)}
            />
          </div>
        ))}

        {isFetchingNextPage && (
          <div className="h-screen flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        )}
      </div>
    </div>
  )
}

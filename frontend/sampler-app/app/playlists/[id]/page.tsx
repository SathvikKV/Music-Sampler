"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Music2, Play, Trash2, Sparkles, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getPlaylistWithTracks, removeTrackFromPlaylist, explainPlaylist } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"

export default function PlaylistDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const qc = useQueryClient()

  // params.id can be array/string/undefined depending on Next
  const playlistId = useMemo(() => {
    const raw = params?.id
    if (!raw) return null
    return Array.isArray(raw) ? raw[0] : (raw as string)
  }, [params])

  // fetch playlist + tracks
  const {
    data: playlist,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["playlist", playlistId],
    queryFn: () => getPlaylistWithTracks(playlistId as string),
    enabled: !!playlistId,
  })

  // remove track (only works if your backend has DELETE /playlists/{id}/tracks/{track_id})
  const removeMutation = useMutation({
    mutationFn: async (payload: { playlist_id: string; track_id: string }) => {
      return removeTrackFromPlaylist(payload.playlist_id, payload.track_id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playlist", playlistId] })
      toast({ title: "Removed from playlist" })
    },
    onError: () => {
      toast({ title: "Could not remove track", variant: "destructive" })
    },
  })

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)

  const handleAnalyze = async () => {
    if (!playlistId) return
    setAnalyzing(true)
    try {
      const res = await explainPlaylist(playlistId)
      setAnalysis(res.explanation)
    } catch (err) {
      toast({ title: "Analysis failed", description: "Could not analyze playlist vibe.", variant: "destructive" })
    } finally {
      setAnalyzing(false)
    }
  }

  const handlePlayTrack = (track: any) => {
    const title = track.title || track.name || "Unknown title"
    const artist = track.artist || track.artists?.join(", ") || "Unknown artist"
    toast({
      title: "Playing track",
      description: `${title} by ${artist}`,
    })
  }

  const handleRemoveTrack = (track: any) => {
    if (!playlistId) return
    const trackId = track.track_id || track.id
    if (!trackId) return
    removeMutation.mutate({ playlist_id: playlistId, track_id: trackId })
  }

  if (!playlistId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading playlist…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-br from-background via-background to-brand/5">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-balance">
              {playlist?.name || "Playlist"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {playlist?.tracks?.length || 0} tracks
            </p>
          </div>
          {playlist?.tracks && playlist.tracks.length > 0 && (
            <Button onClick={handleAnalyze} disabled={analyzing} variant="outline" className="gap-2">
              <Sparkles className="h-4 w-4" />
              {analyzing ? "Analyzing..." : "Analyze Vibe"}
            </Button>
          )}
        </div>

        {/* Analysis Result */}
        {analysis && (
          <Card className="p-6 bg-brand/10 border-brand/20">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brand" />
                  Vibe Check
                </h3>
                <Badge variant="secondary">Consistency: {analysis.consistency}/10</Badge>
              </div>

              <p className="text-lg font-medium">{analysis.vibe}</p>
              <p className="text-muted-foreground">{analysis.analysis}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Genres</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {analysis.genres?.map((g: string) => (
                      <Badge key={g} variant="outline">{g}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Best For</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {analysis.best_for?.map((b: string) => (
                      <Badge key={b} variant="secondary">{b}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="h-24 animate-pulse bg-card/50" />
            ))}
          </div>
        ) : isError ? (
          <Card className="p-6">
            <p className="text-destructive">Could not load this playlist.</p>
          </Card>
        ) : playlist?.tracks && playlist.tracks.length > 0 ? (
          <div className="space-y-3">
            {playlist.tracks.map((track: any) => {
              const trackKey = track.track_id || track.id
              const title = track.title || track.name || "Untitled"
              const artist =
                track.artist || track.artists?.join(", ") || "Unknown artist"

              return (
                <Card
                  key={trackKey}
                  className="p-4 hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-brand/20 flex-shrink-0">
                      <Music2 className="h-6 w-6 text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold line-clamp-1">{title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {artist}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePlayTrack(track)}
                      >
                        <Play className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveTrack(track)}
                      >
                        <Trash2 className="h-5 w-5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="p-12 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted">
              <Music2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">No tracks yet</h3>
              <p className="text-muted-foreground">
                Start exploring music and add tracks to this playlist
              </p>
            </div>
            <Button onClick={() => router.push("/")} size="lg">
              Discover Music
            </Button>
          </Card>
        )}
      </div>
    </div>
  )
}

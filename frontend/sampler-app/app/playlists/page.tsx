// app/playlists/page.tsx
"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Plus, Music2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getPlaylists, createPlaylist } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"

const USER_ID = "1" // still hardcoded like the rest of your app right now

export default function PlaylistsPage() {
  const { toast } = useToast()
  const [creating, setCreating] = useState(false)

  const { data: playlists, isLoading, refetch } = useQuery({
    queryKey: ["playlists", USER_ID],
    queryFn: () => getPlaylists(USER_ID),
  })

  const handleCreate = async () => {
  const name = window.prompt("Playlist name?")?.trim()
  if (!name) return
  setCreating(true)
  try {
    await createPlaylist(USER_ID, name)
    await refetch()
    toast({ title: "Playlist created" })
  } catch (err) {
    console.error(err)
    toast({ title: "Could not create playlist", variant: "destructive" })
  } finally {
    setCreating(false)
  }
}

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-br from-background via-background to-brand/5">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Your playlists</h1>
            <p className="text-muted-foreground">Save tracks you liked while sampling.</p>
          </div>
          <Button onClick={handleCreate} disabled={creating} className="gap-2">
            <Plus className="h-4 w-4" />
            New playlist
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="h-32 animate-pulse bg-card/50" />
            ))}
          </div>
        ) : playlists && playlists.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {playlists.map((playlist) => {
              // normalize id because backend returns { id, ... }
              const pid = (playlist as any).id || (playlist as any).playlist_id
              const name = playlist.name || "Untitled playlist"

              if (!pid) {
                // fallback: render but don’t link
                return (
                  <Card key={name} className="p-6 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-brand/20 flex items-center justify-center">
                        <Music2 className="h-5 w-5 text-brand" />
                      </div>
                      <div>
                        <h2 className="font-semibold">{name}</h2>
                        <p className="text-xs text-muted-foreground">No id returned</p>
                      </div>
                    </div>
                  </Card>
                )
              }

              return (
                <Link key={pid} href={`/playlists/${pid}`}>
                  <Card className="p-6 space-y-4 hover:bg-card/90 hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-brand/20 flex items-center justify-center">
                        <Music2 className="h-5 w-5 text-brand" />
                      </div>
                      <div>
                        <h2 className="font-semibold">{name}</h2>
                        <p className="text-xs text-muted-foreground">
                          {(playlist as any).track_count || 0} tracks
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        ) : (
          <Card className="p-12 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted">
              <Music2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">No playlists yet</h3>
              <p className="text-muted-foreground">
                Create one and start adding tracks from your feed.
              </p>
            </div>
            <Button onClick={handleCreate} disabled={creating}>
              Create playlist
            </Button>
          </Card>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Plus, Music } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { usePlaylistsQuery, useCreatePlaylistMutation } from "@/hooks/use-feed"
import { useSessionStore } from "@/stores/useSessionStore"
import { useToast } from "@/hooks/use-toast"
import type { Playlist } from "@/lib/types"

interface PlaylistDrawerProps {
  onSelectPlaylist: (playlist: Playlist) => void
}

export function PlaylistDrawer({ onSelectPlaylist }: PlaylistDrawerProps) {
  const [open, setOpen] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState("")
  const { userId } = useSessionStore()
  const { toast } = useToast()

  const { data: playlists, refetch } = usePlaylistsQuery(userId)
  const createPlaylistMutation = useCreatePlaylistMutation()

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a playlist name",
        variant: "destructive",
      })
      return
    }

    try {
      const playlist = await createPlaylistMutation.mutateAsync({
        userId,
        name: newPlaylistName,
      })
      setNewPlaylistName("")
      refetch()
      toast({
        title: "Success",
        description: `Created playlist "${playlist.name}"`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create playlist",
        variant: "destructive",
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-transparent">
          <Music className="h-4 w-4" />
          My Playlists
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>My Playlists</SheetTitle>
          <SheetDescription>Create and manage your music collections</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Create New Playlist */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Create New Playlist</label>
            <div className="flex gap-2">
              <Input
                placeholder="Playlist name..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreatePlaylist()
                  }
                }}
              />
              <Button size="icon" onClick={handleCreatePlaylist} disabled={createPlaylistMutation.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Playlists List */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Playlists</label>
            <ScrollArea className="h-[400px] rounded-md border p-4">
              {playlists && playlists.length > 0 ? (
                <div className="space-y-2">
                  {playlists.map((playlist) => (
                    <Button
                      key={playlist.id}
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        onSelectPlaylist(playlist)
                        setOpen(false)
                      }}
                    >
                      <Music className="h-4 w-4 mr-2" />
                      {playlist.name}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">No playlists yet. Create one above!</div>
              )}
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

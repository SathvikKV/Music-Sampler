"use client"

import { useState } from "react"
import { Plus, Check, Music } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { usePlaylistsQuery, useCreatePlaylistMutation } from "@/hooks/use-feed"
import { useSessionStore } from "@/stores/useSessionStore"
import { useToast } from "@/hooks/use-toast"
import type { Playlist } from "@/lib/types"

interface AddToPlaylistDialogProps {
  children: React.ReactNode
  onAddToPlaylist: (playlist: Playlist) => void
}

export function AddToPlaylistDialog({ children, onAddToPlaylist }: AddToPlaylistDialogProps) {
  const [open, setOpen] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState("")
  const { userId } = useSessionStore()
  const { toast } = useToast()

  const { data: playlists, refetch } = usePlaylistsQuery(userId)
  const createPlaylistMutation = useCreatePlaylistMutation()

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return

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
      // Optional: automatically add to the new playlist?
      // For now, just let them select it from the list
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create playlist",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add to Playlist</DialogTitle>
          <DialogDescription>Save this track to one of your playlists.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Create New */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="New playlist name..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreatePlaylist()
              }}
            />
            <Button size="icon" onClick={handleCreatePlaylist} disabled={createPlaylistMutation.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or select existing</span>
            </div>
          </div>

          {/* List */}
          <ScrollArea className="h-[300px] rounded-md border p-2">
            {playlists && playlists.length > 0 ? (
              <div className="space-y-1">
                {playlists.map((playlist) => (
                  <Button
                    key={playlist.id}
                    variant="ghost"
                    className="w-full justify-start font-normal"
                    onClick={() => {
                      onAddToPlaylist(playlist)
                      setOpen(false)
                    }}
                  >
                    <Music className="mr-2 h-4 w-4 text-muted-foreground" />
                    {playlist.name}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8">
                No playlists found. Create one above!
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}

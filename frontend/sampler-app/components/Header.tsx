// components/Header.tsx
"use client"

import { useState } from "react"
import { Music2, ExternalLink, Volume2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlaylistDrawer } from "./PlaylistDrawer"
import { getAuthorizeUrl, getPlaybackToken } from "@/lib/api"
import { useSessionStore } from "@/stores/useSessionStore"
import { useToast } from "@/hooks/use-toast"
import type { Playlist } from "@/lib/types"
import {
  initializeSpotifyPlayer,
  setSpotifyVolume,
  getSpotifyVolume,
  ensureAudioUnlocked,
  maybeTransferToThisDevice,
  waitForDeviceRegistration, // add this
} from "@/lib/spotify"

interface HeaderProps {
  onSelectPlaylist?: (playlist: Playlist) => void
}

export function Header({ onSelectPlaylist }: HeaderProps) {
  const { userId } = useSessionStore()
  const { toast } = useToast()
  const [enabling, setEnabling] = useState(false)


  const handleEnableWebPlayback = async () => {
    setEnabling(true)
    try {
      const tokenGetter = async () => {
        const { token } = await getPlaybackToken(userId)
        return token
      }

      const id = await initializeSpotifyPlayer(tokenGetter)
      console.log("Initialized Spotify Player, device:", id)

      // Unlock audio context (must be inside this user-gesture handler)
      await ensureAudioUnlocked()

      // Wait until Spotify lists our web device
      await waitForDeviceRegistration(8000) // add this import from lib/spotify

      // Transfer once (guarded against 429 / spam)
      await maybeTransferToThisDevice()

      // Set default volume
      await setSpotifyVolume(0.6)

      toast({
        title: "Web Player Ready",
        description: "Playback enabled. Scroll your feed to start listening.",
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({
        title: "Enable Web Playback failed",
        description: msg,
        variant: "destructive",
      })
      console.error("Enable Web Playback failed:", err)
    } finally {
      setEnabling(false)
    }
  }


  const volDown = async () => setSpotifyVolume(Math.max(0, getSpotifyVolume() - 0.1))
  const volUp = async () => setSpotifyVolume(Math.min(1, getSpotifyVolume() + 0.1))

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-muted">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music2 className="h-6 w-6 text-brand" />
          <h1 className="text-xl font-bold">Music Sampler</h1>
        </div>

        <div className="flex items-center gap-2">
          {onSelectPlaylist && <PlaylistDrawer onSelectPlaylist={onSelectPlaylist} />}


          <Button
            variant="default"
            size="sm"
            onClick={handleEnableWebPlayback}
            disabled={enabling}
            className="gap-2"
            title="Enable the Web Playback SDK (required by browsers to allow audio)"
          >
            <Play className="h-4 w-4" />
            {enabling ? "Enabling..." : "Enable Web Playback"}
          </Button>

          <Button variant="outline" size="icon" onClick={volDown} title="Volume down">
            <Volume2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={volUp} title="Volume up">
            <Volume2 className="h-4 w-4 rotate-180" />
          </Button>
        </div>
      </div>
    </header>
  )
}

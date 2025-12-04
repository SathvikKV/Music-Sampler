import { create } from "zustand"

interface PlayerStore {
  activeCardId: string | null
  muted: boolean
  volume: number
  isPlaying: boolean
  setActiveCardId: (id: string | null) => void
  setMuted: (muted: boolean) => void
  setVolume: (volume: number) => void
  setIsPlaying: (playing: boolean) => void
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  activeCardId: null,
  muted: false,
  volume: 0.5,
  isPlaying: false,
  setActiveCardId: (id) => set({ activeCardId: id }),
  setMuted: (muted) => set({ muted }),
  setVolume: (volume) => set({ volume }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
}))

// components/TrackExplanation.tsx
"use client"

import { X } from "lucide-react"

type ExplainData = {
  summary?: string
  vibe?: string
  best_for?: string[]
  because?: string[]
  audio?: {
    energy?: number
    valence?: number
    tempo?: number
    danceability?: number
  }
  meaning?: string
  themes?: string[]
}

interface TrackExplanationProps {
  open: boolean
  onClose: () => void
  loading?: boolean
  data?: ExplainData
}

export function TrackExplanation({ open, onClose, loading, data }: TrackExplanationProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card shadow-lg border p-5 space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-semibold">Track breakdown</h2>

        {loading ? (
          <p className="text-sm text-muted-foreground">Analyzing this song…</p>
        ) : (
          <>
            {/* meaning / summary */}
            {data?.meaning ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Meaning
                </p>
                <p className="text-sm leading-relaxed">{data.meaning}</p>
              </div>
            ) : data?.summary ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Summary
                </p>
                <p className="text-sm leading-relaxed">{data.summary}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t get a detailed explanation for this one.
              </p>
            )}

            {/* themes */}
            {!!data?.themes?.length && (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Themes / undertones
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.themes.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-1 bg-muted rounded-full text-xs text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
            </div>
            )}

            {/* vibe */}
            {data?.vibe && (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Vibe
                </p>
                <p className="text-sm">{data.vibe}</p>
              </div>
            )}

            {/* best for */}
            {!!data?.best_for?.length && (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Best for
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.best_for.map((b) => (
                    <span
                      key={b}
                      className="px-2 py-1 bg-muted rounded-full text-xs text-muted-foreground"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* audio */}
            {data?.audio && (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Audio profile
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {"energy" in data.audio && (
                    <p>
                      <span className="text-muted-foreground text-xs">Energy: </span>
                      {Math.round((data.audio.energy ?? 0) * 100)}%
                    </p>
                  )}
                  {"valence" in data.audio && (
                    <p>
                      <span className="text-muted-foreground text-xs">Valence: </span>
                      {Math.round((data.audio.valence ?? 0) * 100)}%
                    </p>
                  )}
                  {"tempo" in data.audio && (
                    <p>
                      <span className="text-muted-foreground text-xs">BPM: </span>
                      {Math.round(data.audio.tempo ?? 0)}
                    </p>
                  )}
                  {"danceability" in data.audio && (
                    <p>
                      <span className="text-muted-foreground text-xs">Danceability: </span>
                      {Math.round((data.audio.danceability ?? 0) * 100)}%
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* because */}
            {!!data?.because?.length && (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Because
                </p>
                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                  {data.because.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}


// lib/spotify.ts

let spotifyPlayer: Spotify.Player | null = null
let deviceId: string | null = null
let tokenProvider: (() => Promise<string>) | null = null

// Transfer throttling
let lastTransferAt = 0
let inflightTransfer: Promise<void> | null = null
let transferBackoffUntil = 0 // epoch ms

// Local volume target (0..1)
let currentVolume = 0.6

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void
    Spotify: typeof Spotify
  }
}

export function loadSpotifySDK(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof window !== "undefined" && window.Spotify && window.Spotify.Player) {
      resolve()
      return
    }
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
      const s = document.createElement("script")
      s.src = "https://sdk.scdn.co/spotify-player.js"
      s.async = true
      document.body.appendChild(s)
    }
  })
}

export async function initializeSpotifyPlayer(getToken: () => Promise<string>): Promise<string> {
  if (deviceId && spotifyPlayer) return deviceId
  tokenProvider = getToken
  await loadSpotifySDK()

  return new Promise<string>((resolve, reject) => {
    if (!window.Spotify || !window.Spotify.Player) {
      reject(new Error("Spotify SDK not available on window"))
      return
    }

    spotifyPlayer = new window.Spotify.Player({
      name: "Music Sampler Player",
      getOAuthToken: (cb) => {
        getToken()
          .then((t) => cb(t))
          .catch((e) => reject(new Error(`Spotify token error: ${String(e)}`)))
      },
      volume: clamp01(currentVolume),
    })

    spotifyPlayer.addListener("ready", async ({ device_id }: { device_id: string }) => {
      deviceId = device_id
      try {
        await spotifyPlayer?.setVolume(clamp01(currentVolume))
      } catch {}
      resolve(device_id)
    })

    spotifyPlayer.addListener("not_ready", () => {
      // device may drop and come back; keep state
    })

    spotifyPlayer.addListener("initialization_error", ({ message }) =>
      reject(new Error(`Spotify init error: ${message}`)),
    )
    spotifyPlayer.addListener("authentication_error", ({ message }) =>
      reject(new Error(`Spotify auth error: ${message}`)),
    )
    spotifyPlayer.addListener("account_error", ({ message }) =>
      reject(new Error(`Spotify account error: ${message}`)),
    )

    spotifyPlayer
      .connect()
      .then((ok) => {
        if (!ok) reject(new Error("Spotify player connection failed"))
      })
      .catch((err) => reject(err instanceof Error ? err : new Error(String(err))))
  })
}

/** Unlock audio context; call from a user gesture. */
export async function ensureAudioUnlocked(): Promise<void> {
  if (!spotifyPlayer) return
  const anyPlayer = spotifyPlayer as unknown as { activateElement?: () => Promise<void> }
  if (typeof anyPlayer.activateElement === "function") {
    try {
      await anyPlayer.activateElement()
      return
    } catch {}
  }
  try {
    await spotifyPlayer.resume()
    await spotifyPlayer.pause()
  } catch {}
}

/** Poll /v1/me/player/devices until our device is listed or timeout. */
export async function waitForDeviceRegistration(timeoutMs = 8000): Promise<void> {
  if (!deviceId || !tokenProvider) throw new Error("Spotify player not initialized")

  const started = Date.now()
  const poll = async () => {
    const token = await tokenProvider!()
    const res = await fetch("https://api.spotify.com/v1/me/player/devices", {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      // If unauthorized, just let caller retry later
      return false
    }
    const data = (await res.json()) as { devices?: Array<{ id?: string }> }
    return !!data.devices?.some((d) => d.id === deviceId)
  }

  // First try quickly; then poll every 600ms
  if (await poll()) return

  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 600))
    if (await poll()) return
  }

  // Not fatal; device might still be accepted later. Let caller continue.
}

/** Debounced/coalesced transfer with simple 429 backoff. */
export async function maybeTransferToThisDevice(): Promise<void> {
  if (!deviceId || !tokenProvider) throw new Error("Spotify player not initialized")

  if (Date.now() < transferBackoffUntil) return
  if (!shouldTransferNow()) return

  if (inflightTransfer) {
    try {
      await inflightTransfer
    } finally {
      return
    }
  }

  inflightTransfer = (async () => {
    const token1 = await tokenProvider!()
    let res = await fetch("https://api.spotify.com/v1/me/player", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ device_ids: [deviceId], play: false }),
    })

    if (res.status === 401) {
      const token2 = await tokenProvider!()
      res = await fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token2}` },
        body: JSON.stringify({ device_ids: [deviceId], play: false }),
      })
    }

    if (res.status === 429) {
      transferBackoffUntil = Date.now() + 60_000
      inflightTransfer = null
      return
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      inflightTransfer = null
      throw new Error(`Spotify transfer failed ${res.status} ${res.statusText}: ${text}`)
    }

    lastTransferAt = Date.now()
    try {
      await spotifyPlayer?.setVolume(clamp01(currentVolume))
    } catch {}
    inflightTransfer = null
  })()

  await inflightTransfer
}

export async function transferAndPlay({
  uri,
  position_ms,
}: {
  uri: string
  position_ms: number
}): Promise<void> {
  if (!deviceId || !tokenProvider) throw new Error("Spotify player not initialized")

  if (shouldTransferNow()) {
    try {
      await maybeTransferToThisDevice()
    } catch {
      // ignore; still try to play
    }
  }

  const doPlay = async (token: string) =>
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ uris: [uri], position_ms }),
    })

  let res = await doPlay(await tokenProvider!())
  if (res.status === 401) {
    res = await doPlay(await tokenProvider!())
  }

  if (!res.ok && (res.status === 404 || res.status === 403)) {
    try {
      await maybeTransferToThisDevice()
      res = await doPlay(await tokenProvider!())
    } catch {}
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Spotify play failed ${res.status} ${res.statusText}: ${text}`)
  }

  try {
    await spotifyPlayer?.setVolume(clamp01(currentVolume))
  } catch {}
  try {
    await spotifyPlayer?.resume()
  } catch {}
}

export async function pauseSpotify(): Promise<void> {
  if (!spotifyPlayer) return
  try {
    await spotifyPlayer.pause()
  } catch {}
}

export async function setSpotifyVolume(vol: number): Promise<void> {
  currentVolume = clamp01(vol)
  if (spotifyPlayer) {
    try {
      await spotifyPlayer.setVolume(currentVolume)
    } catch {}
  }
}

export function getSpotifyVolume(): number {
  return currentVolume
}

export function getDeviceId(): string | null {
  return deviceId
}

export async function disconnectSpotify(): Promise<void> {
  if (spotifyPlayer) {
    try {
      await spotifyPlayer.disconnect()
    } catch {}
  }
  spotifyPlayer = null
  deviceId = null
  tokenProvider = null
  lastTransferAt = 0
  inflightTransfer = null
  transferBackoffUntil = 0
  currentVolume = 0.6
}

/* helpers */

function shouldTransferNow(): boolean {
  const FIVE_MIN = 5 * 60 * 1000
  if (!lastTransferAt) return true
  return Date.now() - lastTransferAt > FIVE_MIN
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

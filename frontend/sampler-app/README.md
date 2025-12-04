# Music Sampler - TikTok-Style Music Discovery

A production-ready Next.js app that creates a vertical swipe feed for discovering music from Spotify, YouTube, and Audius.

## Features

- 🎵 **Multi-Provider Playback**: Spotify Web Playback SDK, YouTube IFrame API, and Audius streaming
- 📱 **Mobile-First Design**: Optimized for vertical 9:16 cards with touch-friendly interactions
- 🎨 **Purple-First Theme**: Modern design system with deep plum primary and lavender accents
- ♾️ **Infinite Scroll**: Cursor-based pagination with automatic loading
- 💜 **User Feedback**: Like, dislike, save to playlist, and auto-advance
- 📊 **Dwell Time Tracking**: Analytics for user engagement
- 🎧 **Playlist Management**: Create and manage playlists with ease

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **State Management**: Zustand
- **Data Fetching**: TanStack Query v5
- **Media Players**: Spotify Web Playback SDK, YouTube IFrame API, HTML5 Audio

## Setup

### 1. Install Dependencies

\`\`\`bash
pnpm install
\`\`\`

### 2. Environment Variables

Create a `.env.local` file:

\`\`\`env
NEXT_PUBLIC_API_BASE=https://your-backend.ngrok-free.dev
NEXT_PUBLIC_FEED_PAGE_SIZE=10
\`\`\`

Replace `your-backend.ngrok-free.dev` with your FastAPI backend URL.

### 3. Run Development Server

\`\`\`bash
pnpm dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Creating a Session

1. On the home page, describe what you want to explore (e.g., "upbeat indie rock")
2. Click "Start Exploring" to create a personalized feed

### Feed Interactions

- **Auto-Play**: Cards automatically play when they enter the viewport
- **Like**: Tap the heart icon to like a track
- **Dislike**: Tap thumbs down to skip and provide negative feedback
- **Save**: Tap the playlist icon to save to a playlist
- **Auto-Advance**: Tracks automatically advance after the preview duration

### Connecting Spotify

1. Click "Connect Spotify" in the header
2. Authorize the app in the popup window
3. Close the popup after authorization

**Note**: Spotify playback requires a Spotify Premium account.

### Managing Playlists

1. Click "My Playlists" in the header
2. Create new playlists or select existing ones
3. Save tracks by tapping the playlist icon on any card

## Project Structure

\`\`\`
/app
  page.tsx              # Home page with seed input
  feed/page.tsx         # Main vertical feed
  layout.tsx            # Root layout with fonts
  providers.tsx         # TanStack Query provider
  globals.css           # Tailwind + theme tokens

/components
  FeedCard.tsx          # Individual track card
  PlayerManager.tsx     # Player selection logic
  PlaylistDrawer.tsx    # Playlist management UI
  Header.tsx            # App header with actions
  players/
    SpotifyPlayer.tsx   # Spotify Web Playback SDK
    YouTubePlayer.tsx   # YouTube IFrame API
    AudioPlayer.tsx     # HTML5 Audio for Audius

/lib
  api.ts                # API client functions
  spotify.ts            # Spotify SDK initialization
  time.ts               # Time formatting utilities
  analytics.ts          # Dwell time tracking
  types.ts              # TypeScript interfaces

/stores
  useSessionStore.ts    # Session state (user_id, session_id)
  usePlayerStore.ts     # Player state (active card, muted, volume)

/hooks
  use-feed.ts           # TanStack Query hooks
  use-intersection.ts   # Intersection Observer hook
\`\`\`

## API Endpoints

The app expects the following backend endpoints:

- `GET /healthz` - Health check
- `GET /feed` - Fetch feed cards
- `POST /feedback` - Submit user feedback
- `GET /playback/token` - Get Spotify OAuth token
- `GET /auth/spotify/start` - Start Spotify OAuth flow
- `POST /sessions` - Create a new session
- `GET /playlists` - List user playlists
- `POST /playlists` - Create a new playlist
- `POST /playlists/{id}/tracks` - Add track to playlist

## Browser Compatibility

- **Autoplay**: The app respects browser autoplay policies. If autoplay is blocked, users will see an unmute button.
- **Spotify**: Requires Spotify Premium and a modern browser with Web Playback SDK support.
- **YouTube**: Works in all modern browsers with IFrame API support.

## Known Limitations

- Spotify playback requires a Premium account
- Autoplay may be blocked by browser policies (handled gracefully)
- Only one track plays at a time (enforced by PlayerManager)

## Development Notes

- The app uses `user_id = "1"` by default for development
- Dwell time tracking starts when a card enters the viewport
- Auto-advance is enforced via JavaScript timers, not media `ended` events
- Infinite scroll triggers at 80% scroll depth

## License

MIT

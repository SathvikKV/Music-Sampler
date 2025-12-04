# Music Sampler & Discovery App

A modern, AI-powered music discovery application that reimagines how users explore, curate, and analyze music. By combining a "TikTok-style" vertical feed with deep LLM analysis, Sampler offers a rich, immersive experience for music lovers.

## otivation (Why?)

Music discovery has become stagnant. While streaming services offer algorithmic playlists, they often lack context and interactivity. Users want to know *why* a song is recommended, understand the lyrics, and explore the artist's background without leaving the app.

**Sampler** bridges this gap by:
1.  **Visualizing Discovery**: Using a vertical, swipeable feed for rapid exploration.
2.  **Contextualizing Music**: Leveraging AI to provide "Behind the Lyrics" insights and "Vibe Checks" for playlists.
3.  **Unifying Platforms**: Integrating with Spotify to make discovery actionable—save tracks and build playlists instantly.

##  Architecture & Tech Stack

The application is built as a modern, full-stack microservices-lite architecture, designed for performance, scalability, and developer experience.

### Frontend (Client)
Built with **Next.js 15 (App Router)** and **React 19**, focusing on a fluid, app-like experience.
-   **Styling**: Tailwind CSS v4 for a high-performance, utility-first design system.
-   **State Management**: `zustand` for global client state (player, playlist context) and `tanstack-query` for server state management.
-   **UI Components**: Radix UI primitives for accessibility, styled with a custom design system.
-   **Media**: `react-youtube` and Spotify Web Playback SDK for seamless audio/video streaming.

### Backend (Server)
A robust **FastAPI** service that acts as the orchestration layer.
-   **API Layer**: FastAPI (Python 3.11+) with async endpoints for high concurrency.
-   **Database**: PostgreSQL with `asyncpg` and `SQLAlchemy` (Async ORM) for reliable data persistence.
-   **Caching**: Redis for session management, auth tokens, and ephemeral feed data.
-   **AI Engine**: Integration with OpenAI (GPT-4o) for content analysis and Tavily for real-time web search context.

### Infrastructure
-   **Containerization**: Docker & Docker Compose for consistent development and deployment environments.
-   **Migrations**: Alembic for database schema management.

##  Features

-   **Interactive Feed**: Swipe through track previews with a rich, immersive UI.
-   **AI-Powered Analysis**:
    -   **Track Explanations**: Get real-time artist news and deep sonic analysis.
    -   **Playlist Vibe Check**: Analyze the mood, consistency, and best-use cases for your playlists.
-   **Spotify Integration**: Seamlessly connect your Spotify account to save tracks and manage playlists.
-   **Smart Playlists**: Create and manage playlists with AI assistance.

## 🏁 Getting Started

### Prerequisites
-   Docker & Docker Compose
-   Node.js 20+ & pnpm
-   Python 3.11+
-   Spotify Developer Credentials
-   OpenAI & Tavily API Keys

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/sampler.git
    cd sampler
    ```

2.  **Environment Setup**
    -   Create a `.env` file in `backend/` based on `.env.example`.
    -   Fill in your API keys (Spotify, OpenAI, Tavily).

3.  **Launch Backend**
    ```bash
    cd backend
    docker-compose up -d
    # Or run locally:
    # pip install -r requirements.txt
    # uvicorn app.main:app --reload --port 8080
    ```

4.  **Launch Frontend**
    ```bash
    cd frontend/sampler-app
    pnpm install
    pnpm run dev
    ```

5.  **Explore**
    -   Open [http://localhost:3000](http://localhost:3000) to start discovering music.

## 📝 License

MIT

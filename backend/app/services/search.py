# app/services/search.py
from __future__ import annotations
import os
from tavily import TavilyClient

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

class SearchUnavailable(Exception):
    pass

def get_tavily_client():
    if not TAVILY_API_KEY:
        raise SearchUnavailable("TAVILY_API_KEY not set")
    return TavilyClient(api_key=TAVILY_API_KEY)

async def search_artist_news(artist_name: str) -> list[str]:
    """
    Search for recent news or background info about an artist.
    Returns a list of snippets.
    """
    try:
        client = get_tavily_client()
        # We can use the sync client in a thread or just assume it's fast enough for now.
        # Tavily python client is sync by default, but they might have async.
        # Checking docs or source would be good, but for now let's wrap in run_in_executor if needed.
        # Actually, let's just use it directly for now, it's an external API call so it might block.
        # Better to use asyncio.to_thread if it's sync.
        
        import asyncio
        
        query = f"{artist_name} music artist recent news background"
        
        # Run in thread to avoid blocking event loop
        response = await asyncio.to_thread(
            client.search,
            query=query,
            search_depth="basic",
            max_results=3,
            include_answer=False,
            include_raw_content=False,
            include_images=False,
        )
        
        results = response.get("results", [])
        snippets = [r.get("content", "") for r in results if r.get("content")]
        return snippets

    except Exception as e:
        print(f"Search failed: {e}")
        return []

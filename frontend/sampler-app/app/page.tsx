"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Music, Zap, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createSession, getAuthorizeUrl } from "@/lib/api";
import { useSessionStore } from "@/stores/useSessionStore";
import { useToast } from "@/hooks/use-toast";

export default function HomePage() {
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { userId, setSessionId } = useSessionStore();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!seed.trim()) {
      toast({
        title: "Error",
        description: "Please describe what you want to explore",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const effectiveUserId = userId || process.env.NEXT_PUBLIC_DEFAULT_USER_ID || "1";
      const session = await createSession(effectiveUserId, seed);
      setSessionId(session.id);
      router.push(`/feed?session_id=${session.id}&user_id=${effectiveUserId}`);
    } catch (error) {
      console.error("Create session failed:", error);
      toast({
        title: "Error",
        description: "Failed to create session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectSpotify = async () => {
    try {
      const effectiveUserId = userId || process.env.NEXT_PUBLIC_DEFAULT_USER_ID || "1";
      const { authorize_url } = await getAuthorizeUrl(effectiveUserId)
      const authWindow = window.open(authorize_url, "_blank", "width=500,height=700")
      const checkWindow = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkWindow)
          toast({
            title: "Spotify Connected",
            description: "You can now enable the Web Player and play Spotify tracks.",
          })
        }
      }, 1000)
    } catch {
      toast({
        title: "Error",
        description: "Failed to connect Spotify",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/10 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-lg p-8 space-y-8 bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl shadow-primary/10 relative z-10">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 mb-2">
            <Sparkles className="h-10 w-10 text-primary-foreground drop-shadow-lg" />
          </div>
          <h1 className="text-5xl font-bold text-balance bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
            Discover Your Next Favorite Track
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Describe what you want to explore and we'll create a personalized music feed just for you
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="e.g., upbeat indie rock, chill lo-fi beats, 90s hip hop..."
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="h-14 text-lg bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-lg bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg shadow-primary/30 transition-all duration-200"
            disabled={loading}
          >
            {loading ? (
              <>
                <Zap className="h-5 w-5 mr-2 animate-pulse" />
                Creating Your Feed...
              </>
            ) : (
              <>
                <Music className="h-5 w-5 mr-2" />
                Start Exploring
              </>
            )}
          </Button>
        </form>

        <div className="pt-4 border-t border-border/30">
          <Button
            variant="outline"
            size="lg"
            onClick={handleConnectSpotify}
            className="w-full h-14 text-lg gap-2 bg-transparent border-primary/20 hover:bg-primary/5"
          >
            <ExternalLink className="h-5 w-5" />
            Connect Spotify
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground pt-4 border-t border-border/30">
          <p className="flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
            Powered by Spotify, YouTube, and Audius
          </p>
        </div>
      </Card>
    </div>
  );
}

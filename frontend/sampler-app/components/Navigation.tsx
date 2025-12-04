"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, List, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

import { useSessionStore } from "@/stores/useSessionStore"

export function Navigation() {
  const pathname = usePathname()
  const { userId, sessionId } = useSessionStore()

  const getHref = (path: string) => {
    if (path === "/") return "/"
    // For Feed and Playlists, we want to preserve context
    if (!userId) return path

    const params = new URLSearchParams()
    params.set("user_id", userId)
    if (sessionId) params.set("session_id", sessionId)

    return `${path}?${params.toString()}`
  }

  const links = [
    { path: "/", label: "Home", icon: Home },
    { path: "/feed", label: "Feed", icon: Sparkles },
    { path: "/playlists", label: "Playlists", icon: List },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {links.map((link) => {
          const Icon = link.icon
          const href = getHref(link.path)
          const isActive = pathname === link.path || (link.path !== "/" && pathname?.startsWith(link.path))

          return (
            <Link
              key={link.path}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-6 py-2 rounded-xl transition-all duration-200",
                isActive
                  ? "text-primary bg-primary/10 shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]")} />
              <span className="text-xs font-medium">{link.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

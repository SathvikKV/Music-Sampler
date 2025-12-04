import type React from "react"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { Toaster } from "@/components/ui/toaster"
import { Navigation } from "@/components/Navigation"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  title: "Music Sampler - Discover Your Next Favorite Track",
  description: "A TikTok-style music discovery app powered by Spotify, YouTube, and Audius",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable} antialiased`}>
      <body>
        <Providers>
          {children}
          <Toaster />
          <Navigation />
        </Providers>
      </body>
    </html>
  )
}

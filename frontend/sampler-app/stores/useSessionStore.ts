import { create } from "zustand";
import { persist } from "zustand/middleware";

const DEFAULT_USER_ID =
  process.env.NEXT_PUBLIC_DEFAULT_USER_ID || "1";

interface SessionStore {
  userId: string;
  sessionId: string | null;
  setUserId: (userId: string) => void;
  setSessionId: (sessionId: string) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      userId: DEFAULT_USER_ID, // ✅ always have valid user
      sessionId: null,
      setUserId: (userId) => set({ userId }),
      setSessionId: (sessionId) => set({ sessionId }),
      clearSession: () => set({ sessionId: null }),
    }),
    { name: "session-storage" }
  )
);

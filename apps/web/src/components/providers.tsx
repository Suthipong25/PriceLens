"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { UserProfile } from "@pricelens/api-client";
import {
  browserApiClient,
  getStoredAuthToken,
  setStoredAuthToken,
} from "@/lib/client-api";

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  token: string | null;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  token: null,
  loginWithToken: async () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchCurrentProfile() {
    const stored = getStoredAuthToken();
    setToken(stored);
    try {
      const res = await browserApiClient.getMe();
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchCurrentProfile();
    const onAuthChange = () => {
      void fetchCurrentProfile();
    };
    window.addEventListener("pricelens-auth-change", onAuthChange);
    return () => window.removeEventListener("pricelens-auth-change", onAuthChange);
  }, []);

  async function loginWithToken(newToken: string) {
    setLoading(true);
    setStoredAuthToken(newToken);
    await fetchCurrentProfile();
  }

  function logout() {
    setStoredAuthToken(null);
    setUser(null);
    setToken(null);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user,
          loading,
          token,
          loginWithToken,
          logout,
          refreshUser: fetchCurrentProfile,
        }}
      >
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

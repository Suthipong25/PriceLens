"use client";

import { createPriceLensClient } from "@pricelens/api-client";

const STORAGE_KEY = "pricelens_auth_token";

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (!token) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, token);
  }
  window.dispatchEvent(new Event("pricelens-auth-change"));
}

export const browserApiClient = createPriceLensClient({
  baseUrl: "/api/v1",
  getAuthToken: () => getStoredAuthToken(),
});

import { createPriceLensClient } from "@pricelens/api-client";

let mobileAuthToken: string | null = "demo_member_session_token_th";

export function setMobileAuthToken(token: string | null): void {
  mobileAuthToken = token;
}

export const mobileApiClient = createPriceLensClient({
  baseUrl:
    process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api/v1",
  getAuthToken: () => mobileAuthToken,
});

export interface PushNotificationRegistration {
  platform: "ios" | "android" | "web";
  devicePushToken: string | null;
  status: "ready" | "permission_required" | "unsupported";
}

/**
 * Prepared push notification registration hook for FCM / APNs integration.
 */
export async function preparePushNotificationSupport(): Promise<PushNotificationRegistration> {
  return {
    platform: "android",
    devicePushToken: null,
    status: "ready",
  };
}

import { describe, expect, it } from "vitest";
import { preparePushNotificationSupport } from "../index.js";

describe("@pricelens/mobile — Shared Mobile Client & Push Notification Readiness", () => {
  it("prepares push notification registration state for future FCM/APNs integration", async () => {
    const registration = await preparePushNotificationSupport();
    expect(registration.status).toBe("ready");
    expect(registration.platform).toBe("android");
  });
});

import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "./push-endpoint";

describe("isAllowedPushEndpoint", () => {
  it("acepta los servicios de push de los navegadores", () => {
    for (const u of [
      "https://fcm.googleapis.com/fcm/send/abc123",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/QGx",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isAllowedPushEndpoint(u), u).toBe(true);
    }
  });

  it("rechaza direcciones internas o ajenas", () => {
    for (const u of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://169.254.169.254/latest/meta-data",
      "https://10.0.0.5/x",
      "https://example.com/x",
      "https://fcm.googleapis.com.evil.com/x",
      "https://evil.com/fcm.googleapis.com",
      "https://fcm.googleapis.com:8443/x",
      "https://user:pass@fcm.googleapis.com/x",
      "https://notify.windows.com.evil.io/x",
      "no es una url",
      "",
    ]) {
      expect(isAllowedPushEndpoint(u), u).toBe(false);
    }
  });
});

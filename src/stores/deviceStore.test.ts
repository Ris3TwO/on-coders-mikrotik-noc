import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDeviceStore } from "./deviceStore";
import { onStatusUpdate, connectDevice, disconnectDevice } from "@/lib/api";
import { clearPasswordOnly } from "@/lib/secureStore";
import { notify } from "@kyvg/vue3-notification";
import { DeviceStatus } from "@/types";

vi.mock("@/lib/api", () => ({
  onStatusUpdate: vi.fn(),
  connectDevice: vi.fn(),
  disconnectDevice: vi.fn(),
}));

vi.mock("@/lib/secureStore", () => ({
  clearPasswordOnly: vi.fn(),
}));

vi.mock("@kyvg/vue3-notification", () => ({
  notify: vi.fn(),
}));

vi.mock("@/i18n", () => ({
  default: {
    global: {
      t: (key: string) => key,
    },
  },
}));

describe("useDeviceStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("should have initial default state", () => {
    const store = useDeviceStore();
    expect(store.isAuthenticated).toBe(false);
    expect(store.ipAddress).toBe("");
    expect(store.connected).toBe(false);
    expect(store.signal_dbm).toBeNull();
    expect(store.tx_ccq).toBeNull();
    expect(store.traffic_history).toEqual([]);
  });

  describe("getters: signalColor & signalBgColor", () => {
    it("should return muted classes when signal_dbm is null", () => {
      const store = useDeviceStore();
      store.signal_dbm = null;
      expect(store.signalColor).toBe("text-muted");
      expect(store.signalBgColor).toBe("bg-muted/20");
    });

    it("should return emerald classes for strong signal (> -65)", () => {
      const store = useDeviceStore();
      store.signal_dbm = -60;
      expect(store.signalColor).toBe("text-emerald-400");
      expect(store.signalBgColor).toBe("bg-emerald-400");
    });

    it("should return amber classes for moderate signal (-65 to -75)", () => {
      const store = useDeviceStore();
      store.signal_dbm = -70;
      expect(store.signalColor).toBe("text-amber-400");
      expect(store.signalBgColor).toBe("bg-amber-400");
    });

    it("should return red classes for poor signal (< -75)", () => {
      const store = useDeviceStore();
      store.signal_dbm = -80;
      expect(store.signalColor).toBe("text-red-400");
      expect(store.signalBgColor).toBe("bg-red-400");
    });
  });

  describe("getters: ccqColor & ccqBgColor", () => {
    it("should return muted classes when tx_ccq is null", () => {
      const store = useDeviceStore();
      store.tx_ccq = null;
      expect(store.ccqColor).toBe("text-muted");
      expect(store.ccqBgColor).toBe("bg-muted/20");
    });

    it("should return turquoise classes for high CCQ (>= 80)", () => {
      const store = useDeviceStore();
      store.tx_ccq = 85;
      expect(store.ccqColor).toBe("text-brand-turquoise");
      expect(store.ccqBgColor).toBe("bg-brand-turquoise");
    });

    it("should return amber classes for medium CCQ (60 to 79)", () => {
      const store = useDeviceStore();
      store.tx_ccq = 70;
      expect(store.ccqColor).toBe("text-amber-400");
      expect(store.ccqBgColor).toBe("bg-amber-400");
    });

    it("should return red classes for low CCQ (< 60)", () => {
      const store = useDeviceStore();
      store.tx_ccq = 45;
      expect(store.ccqColor).toBe("text-red-400");
      expect(store.ccqBgColor).toBe("bg-red-400");
    });
  });

  describe("actions", () => {
    it("should update state using updateStatus action", () => {
      const store = useDeviceStore();
      store.updateStatus({ connected: true, signal_dbm: -55, device_name: "MikroTik-SXT" });
      expect(store.connected).toBe(true);
      expect(store.signal_dbm).toBe(-55);
      expect(store.device_name).toBe("MikroTik-SXT");
    });

    it("should reset state back to initial values", () => {
      const store = useDeviceStore();
      store.updateStatus({ connected: true, signal_dbm: -50 });
      store.reset();
      expect(store.connected).toBe(false);
      expect(store.signal_dbm).toBeNull();
    });

    it("should handle handleLoginSuccess flow and update traffic history", async () => {
      const store = useDeviceStore();
      const credentials = { ip: "192.168.88.1", user: "admin", pass: "secret" };

      vi.mocked(onStatusUpdate).mockImplementation(
        async (callback: (payload: DeviceStatus) => void) => {
          callback({ connected: true, rx_bps: 1000, tx_bps: 2000 } as DeviceStatus);
          return () => {};
        }
      );

      vi.mocked(connectDevice).mockResolvedValue(undefined as never);

      await store.handleLoginSuccess(credentials);

      expect(store.isAuthenticated).toBe(true);
      expect(store.ipAddress).toBe("192.168.88.1");
      expect(connectDevice).toHaveBeenCalledWith("192.168.88.1", "admin", "secret");
      expect(store.traffic_history.length).toBe(1);
      expect(store.traffic_history[0].rx).toBe(1000);
      expect(store.traffic_history[0].tx).toBe(2000);
    });

    it("should limit traffic history to 30 items", async () => {
      const store = useDeviceStore();
      const credentials = { ip: "192.168.88.1", user: "admin", pass: "secret" };

      vi.mocked(onStatusUpdate).mockImplementation(
        async (callback: (payload: DeviceStatus) => void) => {
          for (let i = 0; i < 35; i++) {
            callback({ connected: true, rx_bps: i * 10, tx_bps: i * 20 } as DeviceStatus);
          }
          return () => {};
        }
      );

      await store.handleLoginSuccess(credentials);
      expect(store.traffic_history.length).toBe(30);
    });

    it("should execute handleLogout flow and clear storage", async () => {
      const store = useDeviceStore();
      store.isAuthenticated = true;
      store.ipAddress = "192.168.88.1";

      vi.mocked(disconnectDevice).mockResolvedValue(undefined as never);
      vi.mocked(clearPasswordOnly).mockResolvedValue(undefined as never);

      await store.handleLogout();

      expect(disconnectDevice).toHaveBeenCalled();
      expect(clearPasswordOnly).toHaveBeenCalled();
      expect(store.isAuthenticated).toBe(false);
      expect(store.ipAddress).toBe("");
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "info",
        })
      );
    });
  });

  describe("deviceStore - Error Handling & Password Cleanup", () => {
    beforeEach(() => {
      setActivePinia(createPinia());
      vi.clearAllMocks();
      localStorage.clear();
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("should execute handleLogout and rethrow when initialization fails in catch block", async () => {
      const store = useDeviceStore();
      const handleLogoutSpy = vi.spyOn(store, "handleLogout");

      const mockError = new Error("Network connection lost");
      vi.mocked(connectDevice).mockRejectedValueOnce(mockError);

      await expect(
        store.handleLoginSuccess({
          ip: "192.168.88.1",
          user: "admin",
          pass: "secret",
        })
      ).rejects.toThrow("Network connection lost");

      expect(console.error).toHaveBeenCalledWith("Initialization failure:", mockError);
      expect(handleLogoutSpy).toHaveBeenCalledTimes(1);
    });

    it("should fallback to localStorage removal if clearPasswordOnly fails", async () => {
      const store = useDeviceStore();
      localStorage.setItem("mikrotik_pass", "secret_pass");

      vi.mocked(clearPasswordOnly).mockRejectedValueOnce(new Error("Keychain unavailable"));

      await store.handleLogout();

      expect(clearPasswordOnly).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem("mikrotik_pass")).toBeNull();
    });
  });

  describe("deviceStore - Traffic History & Status Callback", () => {
    beforeEach(() => {
      setActivePinia(createPinia());
      vi.clearAllMocks();
    });

    it("should push traffic metrics when payload.connected is true and fallback to 0 if rates are missing", async () => {
      let statusCallback: (payload: any) => void = () => {};

      vi.mocked(onStatusUpdate).mockImplementation(async (cb: any) => {
        statusCallback = cb;
        return (() => {}) as any;
      });

      const store = useDeviceStore();

      await store.handleLoginSuccess({
        ip: "192.168.88.1",
        user: "admin",
        pass: "secret",
      });

      statusCallback({
        connected: true,
        rx_bps: 1024,
        tx_bps: 2048,
      });

      expect(store.traffic_history).toHaveLength(1);
      expect(store.traffic_history[0].rx).toBe(1024);
      expect(store.traffic_history[0].tx).toBe(2048);

      statusCallback({
        connected: true,
        rx_bps: null,
        tx_bps: undefined,
      });

      expect(store.traffic_history).toHaveLength(2);
      expect(store.traffic_history[1].rx).toBe(0);
      expect(store.traffic_history[1].tx).toBe(0);
    });

    it("should maintain a rolling window of max 30 items in traffic_history", async () => {
      let statusCallback: (payload: any) => void = () => {};

      vi.mocked(onStatusUpdate).mockImplementation(async (cb: any) => {
        statusCallback = cb;
        return (() => {}) as any;
      });

      const store = useDeviceStore();

      await store.handleLoginSuccess({
        ip: "192.168.88.1",
        user: "admin",
        pass: "secret",
      });

      for (let i = 1; i <= 35; i++) {
        statusCallback({
          connected: true,
          rx_bps: i * 100,
          tx_bps: i * 200,
        });
      }

      expect(store.traffic_history).toHaveLength(30);

      expect(store.traffic_history[0].rx).toBe(600);
      expect(store.traffic_history[29].rx).toBe(3500);
    });

    it("should not push to traffic_history when payload.connected is false", async () => {
      let statusCallback: (payload: any) => void = () => {};

      vi.mocked(onStatusUpdate).mockImplementation(async (cb: any) => {
        statusCallback = cb;
        return (() => {}) as any;
      });

      const store = useDeviceStore();

      await store.handleLoginSuccess({
        ip: "192.168.88.1",
        user: "admin",
        pass: "secret",
      });

      statusCallback({
        connected: false,
        rx_bps: 5000,
        tx_bps: 5000,
      });

      expect(store.traffic_history).toHaveLength(0);
    });
  });
});

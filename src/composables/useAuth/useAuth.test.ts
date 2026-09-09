import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { useAuth } from "./useAuth";
import { invoke } from "@tauri-apps/api/core";
import { notify } from "@kyvg/vue3-notification";
import { getCredentials, saveCredentials } from "@/lib/secureStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@kyvg/vue3-notification", () => ({
  notify: vi.fn(),
}));

vi.mock("@/lib/secureStore", () => ({
  getCredentials: vi.fn(),
  saveCredentials: vi.fn(),
}));

describe("useAuth composable", () => {
  const mockOnSuccess = vi.fn();
  const mockT = vi.fn((key: string) => key);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCredentials).mockResolvedValue(null);
    vi.mocked(saveCredentials).mockResolvedValue(undefined);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize with empty or default values", () => {
    let auth: ReturnType<typeof useAuth>;
    mount({
      setup() {
        auth = useAuth(mockOnSuccess, mockT);
        return {};
      },
      template: "<div />",
    });

    expect(auth!.ip.value).toBe("");
    expect(auth!.user.value).toBe("");
    expect(auth!.pass.value).toBe("");
    expect(auth!.rememberPass.value).toBe(false);
    expect(auth!.isLoading.value).toBe(false);
    expect(auth!.showPassword.value).toBe(false);
  });

  it("should notify and return early if login fields are missing", async () => {
    let auth: ReturnType<typeof useAuth>;
    mount({
      setup() {
        auth = useAuth(mockOnSuccess, mockT);
        return {};
      },
      template: "<div />",
    });

    await flushPromises();
    auth!.ip.value = "";

    await auth!.handleLogin();

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "login.notify.error.missing_fields.title",
        type: "error",
      })
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it("should successfully handle login, store credentials, and trigger success callback", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(true);

    let auth: ReturnType<typeof useAuth>;
    mount({
      setup() {
        auth = useAuth(mockOnSuccess, mockT);
        return {};
      },
      template: "<div />",
    });

    await flushPromises();

    auth!.ip.value = "192.168.88.1";
    auth!.user.value = "admin";
    auth!.pass.value = "secret";
    auth!.rememberPass.value = true;

    const loginPromise = auth!.handleLogin();

    vi.advanceTimersByTime(1500);
    await flushPromises();
    await loginPromise;

    expect(invoke).toHaveBeenCalledWith("test_mikrotik_connection", {
      ip: "192.168.88.1",
      user: "admin",
      pass: "secret",
    });

    expect(saveCredentials).toHaveBeenCalledWith({
      ip: "192.168.88.1",
      user: "admin",
      pass: "secret",
      port: 443,
      useSsl: true,
    });

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "login.notify.success.title",
        type: "success",
      })
    );

    expect(mockOnSuccess).toHaveBeenCalledWith({
      ip: "192.168.88.1",
      user: "admin",
      pass: "secret",
      port: 443,
      useSsl: true,
    });
  });

  it("should handle login failure and notify error", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Connection timeout"));

    let auth: ReturnType<typeof useAuth>;
    mount({
      setup() {
        auth = useAuth(mockOnSuccess, mockT);
        return {};
      },
      template: "<div />",
    });

    await flushPromises();

    auth!.ip.value = "192.168.88.1";
    auth!.user.value = "admin";
    auth!.pass.value = "wrong";

    const loginPromise = auth!.handleLogin().catch(() => {});

    vi.advanceTimersByTime(1500);
    await flushPromises();
    await loginPromise;

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "login.notify.error.authenticationFailed.title",
        text: "login.notify.error.authenticationFailed.text",
        type: "error",
      })
    );
  });

  it("should log error when failing to load secure store credentials (line 43)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(getCredentials).mockRejectedValueOnce(new Error("Failed to access keyring"));

    mount({
      setup() {
        useAuth(mockOnSuccess, mockT);
        return {};
      },
      template: "<div />",
    });

    await flushPromises();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to load secure store credentials:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it("should store empty string for pass in secureStore when rememberPass is false", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(true);

    let auth: ReturnType<typeof useAuth>;
    mount({
      setup() {
        auth = useAuth(mockOnSuccess, mockT);
        return {};
      },
      template: "<div />",
    });

    await flushPromises();

    auth!.ip.value = "192.168.88.1";
    auth!.user.value = "admin";
    auth!.pass.value = "secret";
    auth!.rememberPass.value = false;

    const loginPromise = auth!.handleLogin();

    vi.advanceTimersByTime(1500);
    await flushPromises();
    await loginPromise;

    expect(saveCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        pass: "",
      })
    );
  });

  describe("onMounted auto-login", () => {
    it("should load saved credentials from secureStore and trigger auto-login on mount", async () => {
      vi.mocked(getCredentials).mockResolvedValueOnce({
        ip: "192.168.88.1",
        user: "admin",
        pass: "secret-pass",
        port: 443,
        useSsl: true,
      });

      vi.mocked(invoke).mockResolvedValueOnce(true);

      let composableReturn: any;
      mount({
        setup() {
          composableReturn = useAuth(mockOnSuccess, mockT);
          return {};
        },
        template: "<div />",
      });

      await flushPromises();

      expect(composableReturn.ip.value).toBe("192.168.88.1");
      expect(composableReturn.user.value).toBe("admin");
      expect(composableReturn.rememberPass.value).toBe(true);
      expect(composableReturn.pass.value).toBe("secret-pass");

      vi.advanceTimersByTime(1500);
      await flushPromises();

      expect(invoke).toHaveBeenCalledWith("test_mikrotik_connection", {
        ip: "192.168.88.1",
        user: "admin",
        pass: "secret-pass",
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it("should handle auto-login failure and notify error on mount", async () => {
      vi.mocked(getCredentials).mockResolvedValueOnce({
        ip: "192.168.88.1",
        user: "admin",
        pass: "secret-pass",
        port: 443,
        useSsl: true,
      });

      vi.mocked(invoke).mockRejectedValueOnce(new Error("Network error"));

      mount({
        setup() {
          useAuth(mockOnSuccess, mockT);
          return {};
        },
        template: "<div />",
      });

      await flushPromises();
      vi.advanceTimersByTime(1500);
      await flushPromises();

      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "login.notify.error.auto_login_failed.title",
          text: "Network error",
          type: "error",
        })
      );
    });

    it("should handle auto-login failure with non-Error rejection and use fallback notification text", async () => {
      vi.mocked(getCredentials).mockResolvedValueOnce({
        ip: "192.168.88.1",
        user: "admin",
        pass: "secret-pass",
        port: 443,
        useSsl: true,
      });

      vi.mocked(invoke).mockRejectedValueOnce("Some raw string error");

      mount({
        setup() {
          useAuth(mockOnSuccess, mockT);
          return {};
        },
        template: "<div />",
      });

      await flushPromises();
      vi.advanceTimersByTime(1500);
      await flushPromises();

      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "login.notify.error.auto_login_failed.title",
          text: "login.notify.error.auto_login_failed.text",
          type: "error",
        })
      );
    });

    it("should fallback ip to empty string if savedCredentials.ip is falsy", async () => {
      vi.mocked(getCredentials).mockResolvedValueOnce({
        ip: "",
        user: "admin",
        pass: "secret-pass",
        port: 443,
        useSsl: true,
      });

      let composableReturn: any;
      mount({
        setup() {
          composableReturn = useAuth(mockOnSuccess, mockT);
          return {};
        },
        template: "<div />",
      });

      await flushPromises();

      expect(composableReturn.ip.value).toBe("");
    });

    it("should NOT trigger handleLogin on mount if savedCredentials.pass is empty or falsy", async () => {
      vi.mocked(getCredentials).mockResolvedValueOnce({
        ip: "192.168.88.1",
        user: "admin",
        pass: "",
        port: 443,
        useSsl: true,
      });

      let composableReturn: any;
      mount({
        setup() {
          composableReturn = useAuth(mockOnSuccess, mockT);
          return {};
        },
        template: "<div />",
      });

      await flushPromises();

      expect(composableReturn.ip.value).toBe("192.168.88.1");
      expect(composableReturn.user.value).toBe("admin");
      expect(composableReturn.pass.value).toBe("");
      expect(composableReturn.rememberPass.value).toBe(false);

      vi.advanceTimersByTime(1500);
      await flushPromises();

      expect(invoke).not.toHaveBeenCalled();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it("should fallback user and pass to empty strings if savedCredentials fields are falsy", async () => {
      vi.mocked(getCredentials).mockResolvedValueOnce({
        ip: "192.168.88.1",
        user: undefined as any,
        pass: undefined as any,
        port: 443,
        useSsl: true,
      });

      let composableReturn: any;
      mount({
        setup() {
          composableReturn = useAuth(mockOnSuccess, mockT);
          return {};
        },
        template: "<div />",
      });

      await flushPromises();

      expect(composableReturn.user.value).toBe("");
      expect(composableReturn.pass.value).toBe("");
      expect(composableReturn.rememberPass.value).toBe(false);
      expect(invoke).not.toHaveBeenCalled();
    });
  });
});

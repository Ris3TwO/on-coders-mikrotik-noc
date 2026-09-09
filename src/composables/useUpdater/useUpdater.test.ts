import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useUpdater } from "./useUpdater";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { notify } from "@kyvg/vue3-notification";

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------
vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

vi.mock("@kyvg/vue3-notification", () => ({
  notify: vi.fn(),
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params?.version) {
        return `${key}:${params.version}`;
      }
      return key;
    },
  }),
}));

describe("useUpdater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Initial State", () => {
    it("should initialize with default state values", () => {
      const { isChecking, isDownloading, updateAvailable, newVersion } = useUpdater();

      expect(isChecking.value).toBe(false);
      expect(isDownloading.value).toBe(false);
      expect(updateAvailable.value).toBe(false);
      expect(newVersion.value).toBe("");
    });
  });

  describe("checkForUpdates", () => {
    it("should handle available update successfully (silent = true)", async () => {
      const mockUpdate = {
        version: "v2.0.0",
        downloadAndInstall: vi.fn(),
      };

      vi.mocked(check).mockResolvedValue(mockUpdate as never);

      const { checkForUpdates, updateAvailable, newVersion, isChecking } = useUpdater();

      const promise = checkForUpdates(true);
      expect(isChecking.value).toBe(true);

      await promise;

      expect(isChecking.value).toBe(false);
      expect(updateAvailable.value).toBe(true);
      expect(newVersion.value).toBe("v2.0.0");
      expect(notify).toHaveBeenCalledWith({
        title: "updater.notify.available.title:v2.0.0",
        text: "updater.notify.available.text",
        type: "info",
        duration: 10000,
      });
    });

    it("should show success notification when no update is found and silent is false", async () => {
      vi.mocked(check).mockResolvedValue(null as never);

      const { checkForUpdates, updateAvailable, isChecking } = useUpdater();

      await checkForUpdates(false);

      expect(isChecking.value).toBe(false);
      expect(updateAvailable.value).toBe(false);
      expect(notify).toHaveBeenCalledWith({
        title: "updater.notify.latest.title",
        text: "updater.notify.latest.text",
        type: "success",
      });
    });

    it("should not notify when no update is found and silent is true", async () => {
      vi.mocked(check).mockResolvedValue(null as never);

      const { checkForUpdates } = useUpdater();

      await checkForUpdates(true);

      expect(notify).not.toHaveBeenCalled();
    });

    it("should extract error string when check fails with raw string response (Tauri IPC)", async () => {
      vi.mocked(check).mockRejectedValue("Endpoint unreachable");

      const { checkForUpdates, isChecking } = useUpdater();

      await checkForUpdates(false);

      expect(isChecking.value).toBe(false);
      expect(notify).toHaveBeenCalledWith({
        title: "updater.notify.error.title",
        text: "Endpoint unreachable",
        type: "error",
      });
    });

    it("should fallback to i18n default text when error check fails with unknown value", async () => {
      vi.mocked(check).mockRejectedValue(null);

      const { checkForUpdates } = useUpdater();

      await checkForUpdates(false);

      expect(notify).toHaveBeenCalledWith({
        title: "updater.notify.error.title",
        text: "updater.notify.error.text",
        type: "error",
      });
    });
  });

  describe("installUpdate", () => {
    it("should return early if no update ref exists", async () => {
      const { installUpdate, isDownloading } = useUpdater();

      await installUpdate();

      expect(isDownloading.value).toBe(false);
      expect(notify).not.toHaveBeenCalled();
      expect(relaunch).not.toHaveBeenCalled();
    });

    it("should download, install and relaunch application on success", async () => {
      const mockDownloadAndInstall = vi.fn().mockResolvedValue(undefined);
      const mockUpdate = {
        version: "v2.0.0",
        downloadAndInstall: mockDownloadAndInstall,
      };

      vi.mocked(check).mockResolvedValue(mockUpdate as never);
      vi.mocked(relaunch).mockResolvedValue(undefined as never);

      const { checkForUpdates, installUpdate, isDownloading } = useUpdater();

      await checkForUpdates();

      const promise = installUpdate();
      expect(isDownloading.value).toBe(true);

      await promise;

      expect(isDownloading.value).toBe(false);
      expect(notify).toHaveBeenCalledWith({
        title: "updater.notify.installing.title",
        text: "updater.notify.installing.text",
        type: "info",
      });
      expect(mockDownloadAndInstall).toHaveBeenCalledTimes(1);
      expect(relaunch).toHaveBeenCalledTimes(1);
    });

    it("should extract message from custom error object on installation failure", async () => {
      const customError = { message: "Disk full", code: "ENOSPC" };
      const mockDownloadAndInstall = vi.fn().mockRejectedValue(customError);
      const mockUpdate = {
        version: "v2.0.0",
        downloadAndInstall: mockDownloadAndInstall,
      };

      vi.mocked(check).mockResolvedValue(mockUpdate as never);

      const { checkForUpdates, installUpdate, isDownloading } = useUpdater();

      await checkForUpdates();
      await installUpdate();

      expect(isDownloading.value).toBe(false);
      expect(relaunch).not.toHaveBeenCalled();
      expect(notify).toHaveBeenCalledWith({
        title: "updater.notify.installFailed.title",
        text: "Disk full",
        type: "error",
      });
    });

    it("should NOT notify on update check error when silent is true", async () => {
      vi.mocked(check).mockRejectedValue(new Error("Network connection dropped"));

      const { checkForUpdates, isChecking } = useUpdater();

      await checkForUpdates(true);

      expect(isChecking.value).toBe(false);
      expect(notify).not.toHaveBeenCalled();
    });

    it("should extract message from standard Error instance when silent is false", async () => {
      const error = new Error("Connection timed out");
      vi.mocked(check).mockRejectedValue(error);

      const { checkForUpdates, isChecking } = useUpdater();

      await checkForUpdates(false);

      expect(isChecking.value).toBe(false);
      expect(notify).toHaveBeenCalledWith({
        title: "updater.notify.error.title",
        text: "Connection timed out",
        type: "error",
      });
    });
  });
});

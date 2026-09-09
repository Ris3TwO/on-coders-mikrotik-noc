import { ref } from "vue";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { notify } from "@kyvg/vue3-notification";
import { useI18n } from "vue-i18n";
import { getErrorMessage } from "@/utils/errors";

/**
 * Composable for managing application background update checks,
 * user notifications, and update installation lifecycles.
 */
export const useUpdater = () => {
  const { t } = useI18n();

  const isChecking = ref<boolean>(false);
  const isDownloading = ref<boolean>(false);
  const updateAvailable = ref<boolean>(false);
  const newVersion = ref<string>("");
  const updateRef = ref<Update | null>(null);

  /**
   * Checks for application updates from the configured updater endpoint.
   *
   * @param {boolean} [silent=true] - If false, displays UI notifications when no updates are found or on failure.
   * @returns {Promise<void>}
   */
  const checkForUpdates = async (silent = true): Promise<void> => {
    isChecking.value = true;

    try {
      const update = await check();

      if (update) {
        updateRef.value = update;
        newVersion.value = update.version;
        updateAvailable.value = true;

        notify({
          title: t("updater.notify.available.title", { version: update.version }),
          text: t("updater.notify.available.text"),
          type: "info",
          duration: 10000,
        });
      } else if (!silent) {
        notify({
          title: t("updater.notify.latest.title"),
          text: t("updater.notify.latest.text"),
          type: "success",
        });
      }
    } catch (error) {
      console.error("Failed to check for updates:", error);

      if (!silent) {
        notify({
          title: t("updater.notify.error.title"),
          text: getErrorMessage(error, t("updater.notify.error.text")),
          type: "error",
        });
      }
    } finally {
      isChecking.value = false;
    }
  };

  /**
   * Downloads and installs the pending update in the background,
   * then triggers an application relaunch.
   *
   * @returns {Promise<void>}
   */
  const installUpdate = async (): Promise<void> => {
    if (!updateRef.value) return;

    isDownloading.value = true;

    try {
      notify({
        title: t("updater.notify.installing.title"),
        text: t("updater.notify.installing.text"),
        type: "info",
      });

      await updateRef.value.downloadAndInstall();
      await relaunch();
    } catch (error) {
      console.error("Failed to download or install update:", error);

      notify({
        title: t("updater.notify.installFailed.title"),
        text: getErrorMessage(error, t("updater.notify.installFailed.text")),
        type: "error",
      });
    } finally {
      isDownloading.value = false;
    }
  };

  return {
    isChecking,
    isDownloading,
    updateAvailable,
    newVersion,
    checkForUpdates,
    installUpdate,
  };
};

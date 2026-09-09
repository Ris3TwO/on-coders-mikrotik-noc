import { ref, onMounted } from "vue";
import { notify } from "@kyvg/vue3-notification";
import { invoke } from "@tauri-apps/api/core";
import type { DeviceCredentials, LoginCredentials } from "@/types";
import { saveCredentials, getCredentials } from "@/lib/secureStore";

export const useAuth = (
  onSuccess: (credentials: LoginCredentials) => Promise<void> | void,
  t: (key: string, params?: Record<string, unknown>) => string
) => {
  const ip = ref<string>("");
  const user = ref<string>("");
  const pass = ref<string>("");
  const rememberPass = ref<boolean>(false);
  const isLoading = ref<boolean>(false);
  const showPassword = ref<boolean>(false);

  onMounted(async () => {
    try {
      const savedCredentials = await getCredentials();

      if (savedCredentials) {
        ip.value = savedCredentials.ip || "";
        user.value = savedCredentials.user || "";
        pass.value = savedCredentials.pass || "";

        rememberPass.value = Boolean(savedCredentials.pass);

        if (savedCredentials.pass) {
          handleLogin().catch((err) => {
            notify({
              title: t("login.notify.error.auto_login_failed.title"),
              text:
                err instanceof Error ? err.message : t("login.notify.error.auto_login_failed.text"),
              type: "error",
            });
          });
        }
      }
    } catch (err) {
      console.error("Failed to load secure store credentials:", err);
    }
  });

  const handleLogin = async (): Promise<void> => {
    const trimmedIp = ip.value.trim();
    const trimmedUser = user.value.trim();

    if (!trimmedIp || !trimmedUser || !pass.value) {
      notify({
        title: t("login.notify.error.missing_fields.title"),
        text: t("login.notify.error.missing_fields.text"),
        type: "error",
      });
      return;
    }

    isLoading.value = true;
    const timerPromise = new Promise<void>((res) => setTimeout(res, 1500));
    const apiPromise = invoke<unknown>("test_mikrotik_connection", {
      ip: trimmedIp,
      user: trimmedUser,
      pass: pass.value,
    });

    try {
      await Promise.all([apiPromise, timerPromise]);

      const credentials: DeviceCredentials = {
        ip: trimmedIp,
        user: trimmedUser,
        pass: rememberPass.value ? pass.value : "",
        port: 443,
        useSsl: true,
      };

      await saveCredentials(credentials);

      await onSuccess({
        ...credentials,
        pass: pass.value,
      });

      notify({
        title: t("login.notify.success.title"),
        text: t("login.notify.success.text"),
        type: "success",
      });
    } catch (err: unknown) {
      await timerPromise;
      const errorMsg = typeof err === "string" ? err : "Credenciales inválidas.";

      notify({
        title: t("login.notify.error.authenticationFailed.title"),
        text: t("login.notify.error.authenticationFailed.text", {
          error: errorMsg,
        }),
        type: "error",
      });

      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    ip,
    user,
    pass,
    rememberPass,
    isLoading,
    showPassword,
    handleLogin,
  };
};

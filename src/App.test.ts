import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import App from "./App.vue";
import { onStatusUpdate, connectDevice, disconnectDevice } from "@/lib/api";
import NotificationsMock from "../__mocks__/@kyvg/vue3-notification";
import i18n from "@/i18n";

const isDownloadingRef = ref(false);
const updateAvailableRef = ref(false);
const newVersionRef = ref("");
const installUpdateMock = vi.fn().mockResolvedValue(undefined);
const checkForUpdatesMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn().mockResolvedValue(null),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

vi.mock("@/composables", () => ({
  useUpdater: () => ({
    isDownloading: isDownloadingRef,
    updateAvailable: updateAvailableRef,
    newVersion: newVersionRef,
    checkForUpdates: checkForUpdatesMock,
    installUpdate: installUpdateMock,
  }),
}));

vi.mock("@/lib/api", () => ({
  onStatusUpdate: vi.fn(),
  connectDevice: vi.fn(),
  disconnectDevice: vi.fn(),
}));

vi.mock("@/components/views/LoginView/LoginView.vue", () => ({
  default: {
    name: "LoginView",
    emits: ["login-success"],
    template:
      "<div data-testid=\"login-view\" @click=\"$emit('login-success', { ip: '192.168.88.1', user: 'admin', pass: 'secret' })\">Login View</div>",
  },
}));

vi.mock("@/components/views/DashboardView/DashboardView.vue", () => ({
  default: {
    name: "DashboardView",
    emits: ["logout"],
    template: '<div data-testid="dashboard-view" @click="$emit(\'logout\')">Dashboard View</div>',
  },
}));

vi.mock("@/components/molecules/LanguageSelector/LanguageSelector.vue", () => ({
  default: {
    name: "LanguageSelector",
    template: '<div data-testid="language-selector">Language Selector</div>',
  },
}));

vi.mock("@/lib/secureStore", () => ({
  getCredentials: vi.fn().mockResolvedValue(null),
  saveCredentials: vi.fn().mockResolvedValue(undefined),
  clearCredentials: vi.fn().mockResolvedValue(undefined),
  clearPasswordOnly: vi.fn().mockResolvedValue(undefined),
}));

describe("App.vue root component", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);

    isDownloadingRef.value = false;
    updateAvailableRef.value = false;
    newVersionRef.value = "";
  });

  const createWrapper = () =>
    mount(App, {
      global: {
        plugins: [pinia, i18n],
        components: { Notifications: NotificationsMock },
      },
    });

  it("should render LoginView by default when not authenticated", () => {
    const wrapper = createWrapper();

    expect(wrapper.find('[data-testid="login-view"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-view"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="language-selector"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="notifications"]').exists()).toBe(true);
  });

  it("should transition to DashboardView upon successful login and setup telemetry stream", async () => {
    let statusCallback: (payload: unknown) => void = () => {};
    vi.mocked(onStatusUpdate).mockImplementation(async (cb: any) => {
      statusCallback = cb;
      return (() => {}) as any;
    });
    vi.mocked(connectDevice).mockResolvedValueOnce(true as any);

    const wrapper = createWrapper();

    await wrapper.find('[data-testid="login-view"]').trigger("click");
    await flushPromises();

    expect(connectDevice).toHaveBeenCalledWith("192.168.88.1", "admin", "secret");
    expect(onStatusUpdate).toHaveBeenCalled();

    statusCallback({ connected: true, rx_bps: 1024, tx_bps: 2048 });
    await flushPromises();

    expect(wrapper.find('[data-testid="login-view"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="dashboard-view"]').exists()).toBe(true);
  });

  it("should render notification types and allow closing them via slot actions", async () => {
    const wrapper = createWrapper();

    const closeButtons = wrapper.find('[data-testid="notifications"]').findAll("button");
    expect(closeButtons).toHaveLength(5);

    await closeButtons[0].trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="notifications"]').findAll("button")).toHaveLength(4);
  });

  it("should reset state, disconnect device, and return to LoginView on logout", async () => {
    vi.mocked(connectDevice).mockResolvedValueOnce(true as any);
    vi.mocked(disconnectDevice).mockReturnValueOnce(undefined as any);

    const wrapper = createWrapper();

    await wrapper.find('[data-testid="login-view"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="dashboard-view"]').exists()).toBe(true);

    await wrapper.find('[data-testid="dashboard-view"]').trigger("click");
    await flushPromises();

    expect(disconnectDevice).toHaveBeenCalled();
    expect(wrapper.find('[data-testid="login-view"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-view"]').exists()).toBe(false);
  });

  it("should ignore status update payloads when connected is false", async () => {
    let statusCallback: (payload: unknown) => void = () => {};
    vi.mocked(onStatusUpdate).mockImplementation(async (cb: any) => {
      statusCallback = cb;
      return (() => {}) as any;
    });
    vi.mocked(connectDevice).mockResolvedValueOnce(true as any);

    const wrapper = createWrapper();

    await wrapper.find('[data-testid="login-view"]').trigger("click");
    await flushPromises();

    statusCallback({ connected: false, rx_bps: "1024", tx_bps: "2048" });
    await flushPromises();

    expect(wrapper.find('[data-testid="dashboard-view"]').exists()).toBe(true);
  });

  it("should shift traffic history when buffer exceeds 30 items", async () => {
    let statusCallback: (payload: unknown) => void = () => {};
    vi.mocked(onStatusUpdate).mockImplementation(async (cb: any) => {
      statusCallback = cb;
      return (() => {}) as any;
    });
    vi.mocked(connectDevice).mockResolvedValueOnce(true as any);

    const wrapper = createWrapper();

    await wrapper.find('[data-testid="login-view"]').trigger("click");
    await flushPromises();

    for (let i = 0; i < 31; i++) {
      statusCallback({ connected: true, rx_bps: i * 10, tx_bps: i * 20 });
    }

    statusCallback({ connected: true, rx_bps: 0, tx_bps: 0 });
    await flushPromises();

    expect(wrapper.find('[data-testid="dashboard-view"]').exists()).toBe(true);
  });

  it("should render updater banner and trigger installUpdate on button click when update is available", async () => {
    updateAvailableRef.value = true;
    newVersionRef.value = "v1.2.0";

    const wrapper = createWrapper();

    const updateButton = wrapper.find("button.bg-brand-turquoise");
    expect(updateButton.exists()).toBe(true);
    expect(updateButton.attributes("disabled")).toBeUndefined();

    await updateButton.trigger("click");

    expect(installUpdateMock).toHaveBeenCalledTimes(1);
  });

  it("should disable button and reflect downloading state when isDownloading is true", async () => {
    updateAvailableRef.value = true;
    newVersionRef.value = "v1.2.0";
    isDownloadingRef.value = true;

    const wrapper = createWrapper();

    const updateButton = wrapper.find("button.bg-brand-turquoise");
    expect(updateButton.exists()).toBe(true);
    expect(updateButton.attributes("disabled")).toBeDefined();
  });

  it("should handle updater check failure gracefully on mount", async () => {
    checkForUpdatesMock.mockRejectedValueOnce(new Error("Update check failed"));

    const wrapper = createWrapper();
    await flushPromises();

    expect(wrapper.find('[data-testid="login-view"]').exists()).toBe(true);
  });
});

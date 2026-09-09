import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import NocHeader from "./NocHeader.vue";
import type { DeviceMeta } from "@/types";
import { useDeviceStore } from "@/stores/deviceStore";
import { notify } from "@kyvg/vue3-notification";

vi.mock("@/lib/api", () => ({
  disconnectDevice: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/secureStore", () => ({
  clearPasswordOnly: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@kyvg/vue3-notification", () => ({
  notify: vi.fn(),
}));

vi.mock("vue-i18n");

vi.mock("@/components/atoms/StatusDot/StatusDot.vue", () => ({
  default: {
    name: "StatusDot",
    props: ["connected"],
    template: '<span data-testid="status-dot" :data-connected="connected"></span>',
  },
}));

describe("NocHeader.vue", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
    localStorage.clear();
  });

  const createWrapper = (connected: boolean, deviceMeta: Partial<DeviceMeta>) => {
    return mount(NocHeader, {
      global: {
        plugins: [pinia],
      },
      props: {
        connected,
        deviceMeta: deviceMeta as DeviceMeta,
      },
    });
  };

  it("should render device metadata and online status correctly when connected", () => {
    const wrapper = createWrapper(true, {
      interface: "ether1",
      name: "SXTsq",
      ip: "192.168.88.1",
    });

    expect(wrapper.text()).toContain("ether1");
    expect(wrapper.text()).toContain("MikroTik SXTsq");
    expect(wrapper.text()).toContain("192.168.88.1");
    expect(wrapper.text()).toContain("misc.online");
    expect(wrapper.find('[data-testid="status-dot"]').attributes("data-connected")).toBe("true");
  });

  it("should render fallback values and offline status when disconnected and metadata is missing", () => {
    const wrapper = createWrapper(false, {
      interface: undefined,
      name: undefined,
      ip: undefined,
    });

    expect(wrapper.text()).toContain("misc.noData");
    expect(wrapper.text()).toContain("misc.offline");
    expect(wrapper.find('[data-testid="status-dot"]').attributes("data-connected")).toBe("false");
  });

  it("should trigger deviceStore.handleLogout and clear session on disconnect button click", async () => {
    const wrapper = createWrapper(true, { interface: "wlan1" });
    const store = useDeviceStore();
    const handleLogoutSpy = vi.spyOn(store, "handleLogout");

    const disconnectButton = wrapper.find("button");
    await disconnectButton.trigger("click");

    expect(handleLogoutSpy).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith({
      title: "logout.notify.success.title",
      text: "logout.notify.success.text",
      type: "info",
    });
  });
});
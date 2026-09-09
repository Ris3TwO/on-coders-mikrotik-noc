import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import DashboardView from "./DashboardView.vue";
import { useDeviceStore } from "@/stores/deviceStore";
import type { TrafficPoint } from "@/types";

describe("DashboardView.vue", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  const createWrapper = (
    storeState: {
      connected?: boolean;
      ssid?: string;
      ipAddress?: string;
      device_name?: string;
      iface?: string;
      traffic_history?: TrafficPoint[];
    } = {}
  ) => {
    const deviceStore = useDeviceStore();

    deviceStore.$patch({
      connected: storeState.connected ?? false,
      ssid: storeState.ssid ?? "",
      ipAddress: storeState.ipAddress ?? "192.168.88.1",
      device_name: storeState.device_name ?? "SXTsq",
      iface: storeState.iface ?? "wlan1",
      traffic_history: storeState.traffic_history ?? [],
    });

    return mount(DashboardView, {
      global: {
        plugins: [pinia],
        stubs: {
          NocHeader: {
            template: '<div data-testid="noc-header" @click="$emit(\'logout\')">NocHeader</div>',
          },
          MetricGrid: {
            template: '<div data-testid="metric-grid">MetricGrid</div>',
          },
          TrafficChart: {
            template: '<div data-testid="traffic-chart">TrafficChart</div>',
          },
        },
      },
    });
  };

  it("should render NocHeader and MetricGrid, but hide TrafficChart when device is not connected or ssid is missing", () => {
    const wrapper = createWrapper({
      connected: false,
      ssid: "",
      device_name: "SXTsq",
      ipAddress: "192.168.88.1",
      iface: "ether1",
    });

    expect(wrapper.find('[data-testid="noc-header"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="metric-grid"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="traffic-chart"]').exists()).toBe(false);
  });

  it("should render TrafficChart when device is connected and ssid is present", () => {
    const wrapper = createWrapper({
      connected: true,
      ssid: "TestSSID",
      device_name: "SXTsq",
      ipAddress: "192.168.88.1",
      iface: "ether1",
      traffic_history: [{ time: "10:00:00", rx: 100, tx: 200 }],
    });

    expect(wrapper.find('[data-testid="noc-header"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="metric-grid"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="traffic-chart"]').exists()).toBe(true);
  });

  it("should forward logout event from NocHeader", async () => {
    const wrapper = createWrapper({
      connected: true,
      ssid: "TestSSID",
      device_name: "SXTsq",
      ipAddress: "192.168.88.1",
      iface: "ether1",
    });

    await wrapper.find('[data-testid="noc-header"]').trigger("click");

    expect(wrapper.emitted("logout")).toBeTruthy();
    expect(wrapper.emitted("logout")?.length).toBe(1);
  });

  it("should compute empty strings for deviceMeta name and interface when store values are empty", () => {
    const wrapper = createWrapper({
      connected: true,
      ssid: "TestSSID",
      device_name: "",
      ipAddress: "192.168.88.1",
      iface: "",
    });

    const deviceStore = useDeviceStore();

    expect(deviceStore.device_name).toBe("");
    expect(deviceStore.iface).toBe("");

    expect(wrapper.find('[data-testid="noc-header"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="traffic-chart"]').exists()).toBe(true);
  });
});

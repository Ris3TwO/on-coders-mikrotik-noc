import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import MetricGrid from "./MetricGrid.vue";
import { DeviceStatus } from "@/types";

vi.mock("vue-i18n");

vi.mock("@/utils/formatters", () => ({
  formatBps: (bps: number) => `${bps ?? 0} bps`,
}));

vi.mock("@/components/molecules/LinkWarningAlert/LinkWarningAlert.vue", () => ({
  default: {
    name: "LinkWarningAlert",
    template: '<div data-testid="link-warning-alert">LinkWarningAlert</div>',
  },
}));

vi.mock("@/components/molecules/MetricCard/MetricCard.vue", () => ({
  default: {
    name: "MetricCard",
    props: ["title"],
    template: '<div class="metric-card" :data-title="title"><slot /></div>',
  },
}));

vi.mock("@/components/atoms/TimeDisplay/TimeDisplay.vue", () => ({
  default: {
    name: "TimeDisplay",
    props: ["timestamp"],
    template: '<span data-testid="time-display">{{ timestamp }}</span>',
  },
}));

describe("MetricGrid.vue", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  const createWrapper = (device: Partial<DeviceStatus>) => {
    return mount(MetricGrid, {
      global: {
        plugins: [pinia],
      },
      props: {
        device: device as DeviceStatus,
      },
    });
  };

  it("should render LinkWarningAlert when device is not connected or ssid is missing", () => {
    const wrapper = createWrapper({ connected: false, ssid: "" });

    expect(wrapper.find('[data-testid="link-warning-alert"]').exists()).toBe(true);
  });

  it("should render core metrics cards when device is connected and has ssid", () => {
    const wrapper = createWrapper({
      connected: true,
      ssid: "TestSSID",
      bssid: "00:11:22:33:44:55",
      link_downs: 2,
      last_link_down_time: "1000",
      last_link_up_time: "2000",
      iface: "ether1",
      rx_rate: "150Mbps-20MHz/SGI",
      tx_rate: "150Mbps-20MHz/SGI",
      signal_dbm: -65,
      tx_ccq: 95,
      frequency_mhz: 5180,
      frequency_raw: "5180/20/AC/Ce",
      signal_to_noise: 25,
      noise_floor: -90,
      rx_bps: 500,
      tx_bps: 1200,
    });

    expect(wrapper.find('[data-testid="link-warning-alert"]').exists()).toBe(false);
    expect(wrapper.findAll(".metric-card").length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain("TestSSID");
    expect(wrapper.text()).toContain("00:11:22:33:44:55");
    expect(wrapper.text()).toContain("150Mbps");
    expect(wrapper.text()).toContain("5180 MHz");
  });

  it("should handle null or undefined optional device properties cleanly with default fallbacks", () => {
    const wrapper = createWrapper({
      connected: true,
      ssid: undefined,
      bssid: undefined,
      link_downs: undefined,
      last_link_down_time: undefined,
      last_link_up_time: undefined,
      iface: undefined,
      rx_rate: undefined,
      tx_rate: undefined,
      signal_dbm: undefined,
      tx_ccq: undefined,
      frequency_mhz: undefined,
      frequency_raw: undefined,
      signal_to_noise: undefined,
      noise_floor: undefined,
      rx_bps: undefined,
      tx_bps: undefined,
    });

    expect(wrapper.text()).toContain("--");
    expect(wrapper.find('[data-testid="link-warning-alert"]').exists()).toBe(true);
  });

  it("should parse and format frequency channel correctly with protocol and extension", () => {
    const wrapper = createWrapper({
      connected: true,
      frequency_mhz: 5200,
      frequency_raw: "5200/20/ax/Ce",
    });

    const frequencyCard = wrapper
      .findAll(".metric-card")
      .find((c) => c.attributes("data-title") === "dashboard.frequency");

    expect(frequencyCard?.text()).toContain("dashboard.channel 5GHz (AX/CE)");
  });

  it("should fallback to default channel string if frequency_raw is missing", () => {
    const wrapper = createWrapper({
      connected: true,
      frequency_mhz: 5180,
    });

    const frequencyCard = wrapper
      .findAll(".metric-card")
      .find((c) => c.attributes("data-title") === "dashboard.frequency");

    expect(frequencyCard?.text()).toContain("dashboard.channel 5GHz");
  });

  it("should fallback to default channel string if frequency_raw has less than 4 parts", () => {
    const wrapper = createWrapper({
      connected: true,
      frequency_mhz: 5180,
      frequency_raw: "5180/20",
    });

    const frequencyCard = wrapper
      .findAll(".metric-card")
      .find((c) => c.attributes("data-title") === "dashboard.frequency");

    expect(frequencyCard?.text()).toContain("dashboard.channel 5GHz");
  });

  it("should render fallback '--' for missing identity or rate properties when connected and ssid is present", () => {
    const wrapper = createWrapper({
      connected: true,
      ssid: "TestSSID",
      bssid: undefined,
      rx_rate: undefined,
      tx_rate: undefined,
      signal_dbm: undefined,
      tx_ccq: undefined,
      signal_to_noise: undefined,
      noise_floor: undefined,
    });

    expect(wrapper.text()).toContain("TestSSID");
    expect(wrapper.text()).toContain("--");
  });
});

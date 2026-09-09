import { defineStore } from "pinia";
import { onStatusUpdate, connectDevice, disconnectDevice } from "@/lib/api";
import type { DeviceStatus, LoginCredentials, TrafficPoint } from "@/types";
import { clearPasswordOnly } from "@/lib/secureStore";
import { notify } from "@kyvg/vue3-notification";
import i18n from "@/i18n";

/**
 * Global Pinia store for managing MikroTik device status and telemetry.
 * Handles user authentication state, real-time wireless metrics, and connection parameters.
 */
export const useDeviceStore = defineStore("device", {
  /**
   * Initial state for session details and telemetry metrics.
   */
  state: () => ({
    // -------------------------------------------------------------------------
    // Session State
    // -------------------------------------------------------------------------

    /** Indicates whether the user is successfully authenticated with the device. */
    isAuthenticated: false as boolean,

    /** IP address of the connected MikroTik device. */
    ipAddress: "" as string,

    // -------------------------------------------------------------------------
    // MikroTik Telemetry
    // -------------------------------------------------------------------------

    /** Connection status of the remote device interface. */
    connected: false as boolean,

    /** Received Signal Strength Indicator (RSSI) expressed in dBm (e.g., -65). */
    signal_dbm: null as number | null,

    /** Client Connection Quality (CCQ) percentage for transmission (0-100). */
    tx_ccq: null as number | null,

    /** Client Connection Quality (CCQ) percentage for reception (0-100). */
    rx_ccq: null as number | null,

    /** Operational frequency in Megahertz (e.g., 5180). */
    frequency_mhz: null as number | null,

    /** Raw frequency string returned directly from RouterOS API. */
    frequency_raw: null as string | null,

    /** Current download throughput in bits per second (bps). */
    rx_bps: null as number | null,

    /** Current upload throughput in bits per second (bps). */
    tx_bps: null as number | null,

    /** Error message generated during connection or telemetry updates, if any. */
    error: null as string | null,

    /** Target network interface name (e.g., "wlan1", "ether1"). */
    iface: null as string | null,

    /** Wireless Service Set Identifier (SSID) of the network. */
    ssid: null as string | null,

    /** Basic Service Set Identifier (BSSID) / Access Point MAC address. */
    bssid: null as string | null,

    /** Current wireless receive rate / modulation schema (e.g., "54Mbps-20MHz/1S"). */
    rx_rate: null as string | null,

    /** Current wireless transmit rate / modulation schema. */
    tx_rate: null as string | null,

    /**
     * Circular buffer tracking recent bandwidth usage (maximum of 30 data points)
     * used to render real-time traffic charts.
     */
    traffic_history: [] as TrafficPoint[],

    /** Signal-to-Noise Ratio (SNR) in dB. */
    signal_to_noise: null as number | null,

    /** Ambient noise floor level in dBm. */
    noise_floor: null as number | null,

    /** Cumulative counter of wireless link disconnections. */
    link_downs: null as number | null,

    /** Timestamp recording the last recorded link loss. */
    last_link_down_time: null as string | null,

    /** Timestamp recording the last successful link establishment. */
    last_link_up_time: null as string | null,

    /** Configured identity or system board name of the device. */
    device_name: null as string | null,

    /** ISO timestamp indicating when the session was established. */
    last_connected_at: null as string | null,
  }),

  getters: {
    /**
     * Resolves the appropriate Tailwind CSS text color class based on `signal_dbm`.
     * - Excellent (> -65 dBm): Emerald
     * - Acceptable (-65 dBm to -75 dBm): Amber
     * - Poor (< -75 dBm): Red
     * 
     * @returns {string} Tailwind CSS class utility (e.g., "text-emerald-400").
     */
    signalColor: (state): string => {
      if (state.signal_dbm == null) return "text-muted";
      if (state.signal_dbm > -65) return "text-emerald-400";
      if (state.signal_dbm > -75) return "text-amber-400";
      return "text-red-400";
    },

    /**
     * Resolves the appropriate Tailwind CSS background color class based on `signal_dbm`.
     * 
     * @returns {string} Tailwind CSS class utility (e.g., "bg-emerald-400").
     */
    signalBgColor: (state): string => {
      if (state.signal_dbm == null) return "bg-muted/20";
      if (state.signal_dbm > -65) return "bg-emerald-400";
      if (state.signal_dbm > -75) return "bg-amber-400";
      return "bg-red-400";
    },

    /**
     * Resolves the appropriate Tailwind CSS text color class based on `tx_ccq`.
     * - High (>= 80%): Brand Turquoise
     * - Moderate (60% to 79%): Amber
     * - Low (< 60%): Red
     * 
     * @returns {string} Tailwind CSS class utility (e.g., "text-brand-turquoise").
     */
    ccqColor: (state): string => {
      if (state.tx_ccq == null) return "text-muted";
      if (state.tx_ccq >= 80) return "text-brand-turquoise";
      if (state.tx_ccq >= 60) return "text-amber-400";
      return "text-red-400";
    },

    /**
     * Resolves the appropriate Tailwind CSS background color class based on `tx_ccq`.
     * 
     * @returns {string} Tailwind CSS class utility (e.g., "bg-brand-turquoise").
     */
    ccqBgColor: (state): string => {
      if (state.tx_ccq == null) return "bg-muted/20";
      if (state.tx_ccq >= 80) return "bg-brand-turquoise";
      if (state.tx_ccq >= 60) return "bg-amber-400";
      return "bg-red-400";
    },
  },

  actions: {
    /**
     * Updates store state by merging partial device status payload.
     * 
     * @param {Partial<DeviceStatus>} payload - Partial metrics object received from API listeners.
     */
    updateStatus(payload: Partial<DeviceStatus>): void {
      Object.assign(this, payload);
    },

    /**
     * Handles the successful authentication flow by attaching event listeners,
     * maintaining rolling traffic history, and initiating connection to the remote device.
     * 
     * @param {LoginCredentials} credentials - Connection payload containing IP, username, and password.
     * @returns {Promise<void>} Resolves when connection and listeners are initialized.
     * @throws {Error} Propagates error on initialization or authentication failure.
     */
    async handleLoginSuccess(credentials: LoginCredentials): Promise<void> {
      this.isAuthenticated = true;
      this.ipAddress = credentials.ip;

      try {
        await onStatusUpdate((payload: Partial<DeviceStatus>) => {
          this.updateStatus(payload);

          if (payload.connected) {
            const timeNow = new Date().toLocaleTimeString();
            this.traffic_history.push({
              time: timeNow,
              rx: payload.rx_bps || 0,
              tx: payload.tx_bps || 0,
            });

            // Retain a fixed rolling window of max 30 readings
            if (this.traffic_history.length > 30) {
              this.traffic_history.shift();
            }
          }
        });

        await connectDevice(credentials.ip, credentials.user, credentials.pass);
      } catch (error) {
        console.error("Initialization failure:", error);
        this.handleLogout();
        throw error;
      }
    },

    /**
     * Terminate active user session: disconnects remote listeners, clears secure 
     * local storage credentials, resets Pinia state, and triggers a UI notification.
     * 
     * @returns {Promise<void>}
     */
    async handleLogout(): Promise<void> {
      // 1. Disconnect active sockets or listeners
      await disconnectDevice();

      // 2. Clear stored credentials
      await clearPasswordOnly().catch(() => {
        localStorage.removeItem("mikrotik_pass");
      });

      // 3. Reset Pinia store state
      this.$reset();

      // 4. Trigger global notification UI
      notify({
        title: i18n.global.t("logout.notify.success.title"),
        text: i18n.global.t("logout.notify.success.text"),
        type: "info",
      });
    },

    /**
     * Resets the store state back to its default values.
     */
    reset(): void {
      this.$reset();
    },
  },
});
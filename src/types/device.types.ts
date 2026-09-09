import { LoginCredentials } from "./auth.types";

/**
 * Comprehensive real-time telemetry status data structure received from the MikroTik device.
 */
export interface DeviceStatus {
  /** Connection status flag */
  connected: boolean;
  /** Received signal strength indicator in dBm */
  signal_dbm: number | null;
  /** Transmission client connection quality percentage */
  tx_ccq: number | null;
  /** Reception client connection quality percentage */
  rx_ccq: number | null;
  /** Operating channel frequency in MHz */
  frequency_mhz: number | null;
  /** Raw channel frequency string identifier */
  frequency_raw: string | null;
  /** Current incoming bits per second */
  rx_bps: number | null;
  /** Current outgoing bits per second */
  tx_bps: number | null;
  /** Last error message encountered during polling */
  error: string | null;
  /** Active wireless interface name */
  iface: string | null;
  /** Wireless network service set identifier */
  ssid: string | null;
  /** Basic service set identifier (MAC address) of the access point */
  bssid: string | null;
  /** Current reception PHY data rate */
  rx_rate: string | null;
  /** Current transmission PHY data rate */
  tx_rate: string | null;
  /** Historical data points tracking network traffic */
  traffic_history: TrafficPoint[];
  /** Signal-to-noise ratio in dB */
  signal_to_noise: number | null;
  /** Measured background noise floor in dBm */
  noise_floor: number | null;
  /** Total count of recorded link down events */
  link_downs: number | null;
  /** Timestamp of the most recent link down event */
  last_link_down_time: string | null;
  /** Timestamp of the most recent link up event */
  last_link_up_time: string | null;
  /** Timestamp of when the session was last successfully established */
  last_connected_at: string | null;
  /** Friendly identification name assigned to the MikroTik hardware unit */
  device_name: string | null;
}

/**
 * Metadata profile describing a targeted device configuration.
 */
export interface DeviceMeta {
  /** Friendly device designation name */
  name: string;
  /** Device management IP address */
  ip: string;
  /** Network interface identifier */
  interface: string;
}

/**
 * Single data point representing throughput metrics at a specific timestamp.
 */
export interface TrafficPoint {
  /** ISO timestamp string or formatted time label */
  time: string;
  /** Incoming traffic rate */
  rx: number;
  /** Outgoing traffic rate */
  tx: number;
}

export interface DeviceCredentials extends LoginCredentials {
  port: number;
  useSsl: boolean;
}
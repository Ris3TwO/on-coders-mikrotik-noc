import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveCredentials,
  getCredentials,
  clearCredentials,
  clearPasswordOnly,
} from "./secureStore";
import type { DeviceCredentials } from "@/types";

const mockStoreData = new Map<string, unknown>();

vi.mock("@tauri-apps/plugin-store", () => {
  return {
    LazyStore: vi.fn().mockImplementation(function () {
      return {
        set: vi.fn((key: string, value: unknown) => {
          mockStoreData.set(key, value);
          return Promise.resolve();
        }),
        get: vi.fn((key: string) => {
          return Promise.resolve(mockStoreData.get(key));
        }),
        delete: vi.fn((key: string) => {
          mockStoreData.delete(key);
          return Promise.resolve(true);
        }),
        save: vi.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

describe("secureStore utility module", () => {
  const mockCredentials: DeviceCredentials = {
    ip: "192.168.88.1",
    user: "admin",
    pass: "supersecret",
    port: 8728,
    useSsl: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreData.clear();
  });

  it("should store device credentials and flush to disk via saveCredentials", async () => {
    await saveCredentials(mockCredentials);

    const storedData = mockStoreData.get("device_config");
    expect(storedData).toEqual(mockCredentials);
  });

  it("should retrieve stored credentials via getCredentials", async () => {
    mockStoreData.set("device_config", mockCredentials);

    const credentials = await getCredentials();
    expect(credentials).toEqual(mockCredentials);
  });

  it("should return null from getCredentials when store is empty", async () => {
    const credentials = await getCredentials();
    expect(credentials).toBeNull();
  });

  it("should remove credentials entry completely via clearCredentials", async () => {
    mockStoreData.set("device_config", mockCredentials);

    await clearCredentials();

    expect(mockStoreData.has("device_config")).toBe(false);
    const credentials = await getCredentials();
    expect(credentials).toBeNull();
  });

  it("should wipe password while preserving other fields via clearPasswordOnly", async () => {
    mockStoreData.set("device_config", mockCredentials);

    await clearPasswordOnly();

    const storedData = mockStoreData.get("device_config") as DeviceCredentials;
    expect(storedData).toBeDefined();
    expect(storedData.pass).toBe("");
    expect(storedData.ip).toBe("192.168.88.1");
    expect(storedData.user).toBe("admin");
    expect(storedData.port).toBe(8728);
    expect(storedData.useSsl).toBe(false);
  });

  it("should do nothing in clearPasswordOnly if no credentials exist", async () => {
    await clearPasswordOnly();

    const credentials = await getCredentials();
    expect(credentials).toBeNull();
    expect(mockStoreData.has("device_config")).toBe(false);
  });
});
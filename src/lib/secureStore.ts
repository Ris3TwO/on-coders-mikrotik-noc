import { LazyStore } from '@tauri-apps/plugin-store';
import type { DeviceCredentials } from '@/types';

/**
 * Lazy-loaded persistent encrypted store instance for managing connection credentials.
 * Utilizes the `credentials.bin` binary file managed via Tauri Plugin Store.
 */
const store = new LazyStore('credentials.bin');

/**
 * Persists or updates device connection credentials in the encrypted storage.
 *
 * @param creds - Object containing target device credentials (`DeviceCredentials`).
 * @returns A promise that resolves when the payload is written and flushed to disk.
 */
export async function saveCredentials(creds: DeviceCredentials): Promise<void> {
  await store.set('device_config', creds);
  await store.save();
}

/**
 * Retrieves the persisted device connection credentials from disk.
 *
 * @returns A promise resolving to stored `DeviceCredentials` or `null` if uninitialized.
 */
export async function getCredentials(): Promise<DeviceCredentials | null> {
  return (await store.get<DeviceCredentials>('device_config')) || null;
}

/**
 * Completely removes the stored credentials entry from persistent storage.
 *
 * @returns A promise that resolves once the deletion is flushed to disk.
 */
export async function clearCredentials(): Promise<void> {
  await store.delete('device_config');
  await store.save();
}

/**
 * Clears only the password field from the stored credentials while retaining
 * all other connection configuration properties (e.g., IP address, username, port).
 *
 * @returns A promise that resolves once the modified credentials are saved to disk.
 */
export async function clearPasswordOnly(): Promise<void> {
  const current = await getCredentials();
  
  if (current) {
    const updatedCredentials: DeviceCredentials = {
      ...current,
      pass: "",
    };
    
    await store.set('device_config', updatedCredentials);
    await store.save();
  }
}
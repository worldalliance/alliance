import { userRegisterDevice } from "@alliance/shared/client";
import { modelId, modelName } from "expo-device";
import { SecureStorage, SecureStorageKey } from "./SecureStorage";

export async function registerPushDevice(token?: string): Promise<void> {
  if (!token) {
    return;
  }
  try {
    const deviceId = await SecureStorage.getItem(SecureStorageKey.DEVICE_ID);
    const resp = await userRegisterDevice({
      body: {
        deviceType: modelId ?? modelName,
        expoPushToken: token,
        deviceId: deviceId ?? undefined,
      },
    });
    if (resp.data) {
      const id = resp.data.id;
      await SecureStorage.setItem(SecureStorageKey.DEVICE_ID, id);
      await SecureStorage.setItem(SecureStorageKey.REGISTERED_TOKEN, token);
    }
  } catch (e) {
    console.error("push device registration failed", e);
  }
}

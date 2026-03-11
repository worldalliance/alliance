import { EventEmitter, Subscription } from "expo-modules-core";
import { Platform } from "react-native";

export interface PushToStartTokenEvent {
  token: string;
}

export interface ActivityInstance {
  id: string;
  actionName: string;
  completedCount: number;
  pushToken?: string;
}

let nativeModule: any = null;
let emitter: EventEmitter | null = null;

if (Platform.OS === "ios") {
  try {
    const { requireNativeModule } = require("expo-modules-core");
    nativeModule = requireNativeModule("LiveActivityTokens");
    emitter = new EventEmitter(nativeModule);
  } catch {
    console.warn("LiveActivityTokens native module not available");
  }
}

export function addPushToStartTokenListener(
  listener: (event: PushToStartTokenEvent) => void
): Subscription {
  if (!emitter) {
    // Return a no-op subscription
    return { remove: () => {} } as Subscription;
  }
  return emitter.addListener("onPushToStartToken", listener);
}

export async function getActivityInstances(): Promise<ActivityInstance[]> {
  if (!nativeModule) return [];
  return nativeModule.getActivityInstances();
}

export default {
  addPushToStartTokenListener,
  getActivityInstances,
};

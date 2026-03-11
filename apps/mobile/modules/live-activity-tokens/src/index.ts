import {
  requireOptionalNativeModule,
  type EventEmitter,
  type EventSubscription,
} from "expo-modules-core";
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

type LiveActivityTokensEvents = {
  onPushToStartToken: (event: PushToStartTokenEvent) => void;
};

type LiveActivityTokensModule = EventEmitter<LiveActivityTokensEvents> & {
  getActivityInstances(): Promise<ActivityInstance[]>;
};

const nativeModule =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<LiveActivityTokensModule>(
        "LiveActivityTokens"
      )
    : null;

export function addPushToStartTokenListener(
  listener: (event: PushToStartTokenEvent) => void
): EventSubscription {
  if (!nativeModule) {
    return { remove: () => {} };
  }
  console.log("nativeModule: ", nativeModule);
  return nativeModule.emitter.addListener(listener);
}

export async function getActivityInstances(): Promise<ActivityInstance[]> {
  if (!nativeModule) return [];
  return nativeModule.getActivityInstances();
}

export default {
  addPushToStartTokenListener,
  getActivityInstances,
};

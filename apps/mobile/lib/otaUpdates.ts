import * as Updates from "expo-updates";

export const OTA_UPDATES_ENABLED = Updates.isEnabled && !__DEV__;

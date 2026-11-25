import { useEffect, useState } from "react";
import { Linking, Modal, View } from "react-native";
import { STORE, storeHasNewerBuild } from "../lib/storeUpdate";
import Button, { ButtonColor } from "./system/Button";
import Text, { FontWeight } from "./system/Text";

const CHECK_DELAY_MS = 1500;

/** After launch, prompts once when the store has a build newer than this install. */
const UpdateAvailableModal = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      // Offline or server unreachable — check again next launch.
      const newer = await storeHasNewerBuild();
      if (newer.ok && newer.value) setVisible(true);
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const store = STORE;
  if (!visible) return null;

  return (
    <Modal visible transparent onRequestClose={() => setVisible(false)}>
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View className="bg-white rounded-2xl p-5 w-full gap-2">
          <Text className="text-xl" weight={FontWeight.Bold}>
            Update available
          </Text>
          <Text className="text-base text-zinc-600">
            A new version of Alliance is available. Download it to keep getting
            the latest features and fixes.
          </Text>
          <View className="flex-row justify-end gap-2 mt-3">
            <Button
              title="Not now"
              color={ButtonColor.Light}
              onPress={() => setVisible(false)}
            />
            {store && (
              <Button
                title="Update"
                color={ButtonColor.Green}
                onPress={() => Linking.openURL(store.url)}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default UpdateAvailableModal;

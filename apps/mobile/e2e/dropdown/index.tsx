import { registerRootComponent } from "expo";
import { useFonts } from "expo-font";
import { useState } from "react";
import { Button, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import BottomSheetOptionPicker from "../../components/BottomSheetOptionPicker";
import Text from "../../components/system/Text";
import "../../global.css";

const options = Array.from({ length: 40 }, (_, index) => {
  const value = String(index + 1).padStart(2, "0");
  return { value, label: `Option ${value}` };
});

function Fixture() {
  const [visible, setVisible] = useState(false);
  const [plainVisible, setPlainVisible] = useState(false);
  const [value, setValue] = useState("30");
  const [plainValue, setPlainValue] = useState("01");
  const [loaded, error] = useFonts({
    "Source Sans 3": require("../../assets/fonts/SourceSans3-Regular.ttf"),
    "Source Sans 3 Semibold": require("../../assets/fonts/SourceSans3-Semibold.ttf"),
  });
  if (error) throw error;
  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
          <View style={{ padding: 24, gap: 16 }}>
            <Text>Selected {value}</Text>
            <Button
              title="Open searchable picker"
              onPress={() => setVisible(true)}
            />
            <Text>Plain selected {plainValue}</Text>
            <Button
              title="Open plain picker"
              onPress={() => setPlainVisible(true)}
            />
          </View>
          <BottomSheetOptionPicker
            visible={visible}
            searchable
            onClose={() => setVisible(false)}
            title="Searchable options"
            options={options}
            value={value}
            onSelect={setValue}
          />
          <BottomSheetOptionPicker
            visible={plainVisible}
            onClose={() => setPlainVisible(false)}
            title="Plain options"
            options={options.slice(0, 3)}
            value={plainValue}
            onSelect={setPlainValue}
          />
        </SafeAreaView>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

registerRootComponent(Fixture);

import type { FormValue } from "@alliance/common/forms/form-schema";
import {
  type FormValueUpdater,
  resolveFormValue,
} from "@alliance/shared/forms/formValueUpdater";
import { registerRootComponent } from "expo";
import { useFonts } from "expo-font";
import { useState } from "react";
import { Button, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import BottomSheetOptionPicker from "../../components/BottomSheetOptionPicker";
import { RenderField } from "../../components/forms/RenderField";
import Text from "../../components/system/Text";
import "../../global.css";

const options = Array.from({ length: 40 }, (_, index) => {
  const value = String(index + 1).padStart(2, "0");
  return { value, label: `Option ${value}` };
});

const places = [
  "New York",
  "New Jersey",
  "Côte d'Ivoire",
  "California",
  "A place with a label long enough to wrap across the chip row",
  "**Bold** choice",
].map((label, index) => ({ label, value: `p${index + 1}` }));

function useAnswer(initial: FormValue) {
  const [value, setValue] = useState(initial);
  const onChange = (update: FormValueUpdater) =>
    setValue((previous) => resolveFormValue(update, previous));
  const text =
    Array.isArray(value) && value.length > 0 ? value.join(",") : "none";
  return { value, onChange, text };
}

function MultiselectFixture() {
  const searchable = useAnswer(["p4"]);
  const plain = useAnswer([]);
  return (
    <View style={{ gap: 16 }}>
      <RenderField
        field={{
          id: "places",
          type: "input",
          kind: "multiselect",
          label: "Searchable places",
          dropdown: true,
          searchable: true,
          maxSelections: 3,
          options: places,
        }}
        value={searchable.value}
        onChange={searchable.onChange}
      />
      <Text>Places {searchable.text}</Text>
      <RenderField
        field={{
          id: "plain",
          type: "input",
          kind: "multiselect",
          label: "Plain places",
          dropdown: true,
          options: places.slice(0, 3),
        }}
        value={plain.value}
        onChange={plain.onChange}
      />
      <Text>Plain places {plain.text}</Text>
      <RenderField
        field={{
          id: "readonly",
          type: "input",
          kind: "multiselect",
          label: "Read-only places",
          dropdown: true,
          options: places,
        }}
        value={["p5"]}
        disabled
      />
    </View>
  );
}

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
            <MultiselectFixture />
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

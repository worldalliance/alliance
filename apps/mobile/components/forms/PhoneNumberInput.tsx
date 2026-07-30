import { type CountryCode } from "@alliance/common/phone";
import {
  filterPhoneCountries,
  phoneCountryInfo,
} from "@alliance/common/phone-countries";
import { usePhoneNumberField } from "@alliance/shared/lib/usePhoneNumberField";
import { cn } from "@alliance/shared/styles/util";
import { ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/style/colors";
import Text, { FontWeight } from "../system/Text";
import FormModal from "./FormModal";

type Props = {
  value: string;
  onChange: (value: string) => void;
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  error?: string | null;
  onEditingChange?: (editing: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function PhoneNumberInput({
  value,
  onChange,
  country,
  onCountryChange,
  error,
  onEditingChange,
  placeholder = "Enter phone number",
  disabled,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = phoneCountryInfo(country);
  const matches = filterPhoneCountries(query);
  const { displayValue, beginEditing, endEditing, changeText, changeCountry } =
    usePhoneNumberField({
      value,
      onChange,
      country,
      onCountryChange,
      onEditingChange,
    });

  const pick = (picked: CountryCode) => {
    changeCountry(picked);
    setPickerOpen(false);
    setQuery("");
  };

  return (
    <View>
      <View
        className={cn(
          "flex-row items-center rounded-lg border bg-white",
          error ? "border-red-500" : "border-zinc-200",
        )}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setPickerOpen(true)}
          disabled={disabled}
          className="flex-row items-center gap-x-1 py-3 pl-3 pr-2"
          accessibilityLabel="Country"
          accessibilityRole="button"
        >
          <Text className="text-xl">{selected.flag}</Text>
          <Text className="text-base text-zinc-600">
            +{selected.callingCode}
          </Text>
          <ChevronDown size={16} color={colors.text.icon} />
        </TouchableOpacity>
        <View className="w-px self-stretch my-2 bg-zinc-200" />
        <TextInput
          className="flex-1 px-3 py-3 text-base"
          value={displayValue}
          onChangeText={changeText}
          onFocus={beginEditing}
          onBlur={endEditing}
          placeholder={placeholder}
          placeholderTextColor={colors.text.light}
          keyboardType="phone-pad"
          editable={!disabled}
        />
      </View>
      {error && <Text className="mt-1 text-sm text-red-500">{error}</Text>}

      <FormModal visible={pickerOpen} onClose={() => setPickerOpen(false)}>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg text-zinc-900" weight={FontWeight.Semibold}>
            Select country
          </Text>
          <TouchableOpacity onPress={() => setPickerOpen(false)}>
            <Text className="text-blue-600" weight={FontWeight.Medium}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
        <View className="border border-zinc-200 rounded-lg mb-3">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search countries…"
            placeholderTextColor={colors.text.light}
            className="px-3 py-2 text-base text-zinc-900"
            autoFocus
          />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 420 }}
          contentContainerClassName="pb-2"
        >
          {matches.length === 0 ? (
            <Text className="text-zinc-500 p-3 text-center">No matches</Text>
          ) : (
            matches.map((option) => (
              <TouchableOpacity
                key={option.country}
                activeOpacity={0.8}
                onPress={() => pick(option.country)}
                className={cn(
                  "px-3 py-3 rounded-lg mb-2 border flex-row justify-between items-center",
                  option.country === country
                    ? "border-green-600 bg-green-50"
                    : "border-zinc-200 bg-white",
                )}
              >
                <Text className="text-base text-zinc-900">
                  {option.flag} {option.name}
                </Text>
                <Text className="text-sm text-zinc-600 shrink-0">
                  +{option.callingCode}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </FormModal>
    </View>
  );
}

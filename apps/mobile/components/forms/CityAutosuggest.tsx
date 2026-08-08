import type { CitySearchDto } from "@alliance/shared/client";
import {
  formatCityDisplay,
  useCityAutosuggest,
} from "@alliance/shared/forms/cityAutosuggest";
import { cn } from "@alliance/shared/styles/util";
import { useEffect } from "react";
import { ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import Text from "../system/Text";
import FormModal from "./FormModal";

type Props = {
  value?: string;
  onSelect: (city: CitySearchDto | string) => void;
  placeholder?: string;
  minLength?: number;
  debounceMs?: number;
  disabled?: boolean;
  allowCustomValue?: boolean;
};

export default function CityAutosuggestMobile({
  value = "",
  onSelect,
  placeholder = "Search a city…",
  minLength = 1,
  debounceMs = 150,
  disabled = false,
  allowCustomValue = true,
}: Props) {
  const {
    query,
    setQuery,
    results,
    open,
    setOpen,
    highlighted,
    setHighlighted,
    selectCity,
    fetchGeolocation,
  } = useCityAutosuggest({
    value,
    minLength,
    debounceMs,
    allowCustomValue,
    onSelect,
  });

  useEffect(() => {
    if (open) fetchGeolocation();
  }, [open, fetchGeolocation]);

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          setQuery(query);
          setOpen(true);
        }}
        disabled={disabled}
        className={cn(
          "w-full rounded-lg border border-zinc-200 px-3 py-3 bg-white",
          disabled && "opacity-60",
        )}
      >
        <TextInput
          value={query}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          editable={false}
          pointerEvents="none"
          className="text-base text-zinc-900"
        />
      </TouchableOpacity>

      <FormModal visible={open} onClose={() => setOpen(false)}>
        <TextInput
          value={query}
          onChangeText={(text) => setQuery(text)}
          placeholder="Search cities..."
          placeholderTextColor="#9ca3af"
          className="border border-zinc-200 rounded-lg px-3 py-2 text-base text-zinc-900 mb-3"
          autoFocus
        />
        <ScrollView keyboardShouldPersistTaps="handled">
          {results.length === 0 && query.trim().length > 0 ? (
            <Text className="text-center text-zinc-500 py-4">No matches</Text>
          ) : (
            results.map((city, idx) => {
              const isActive = idx === highlighted;
              return (
                <TouchableOpacity
                  key={`${city.name}-${city.admin1}-${city.countryCode}`}
                  className={cn(
                    "px-3 py-3 rounded-lg mb-2",
                    isActive ? "bg-zinc-100" : "bg-white",
                  )}
                  activeOpacity={0.8}
                  onPress={() => {
                    selectCity(city);
                    setOpen(false);
                  }}
                  onFocus={() => setHighlighted(idx)}
                >
                  <Text className="text-base text-zinc-900">
                    {formatCityDisplay(city)}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </FormModal>
    </View>
  );
}

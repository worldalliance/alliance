import { SearchItemDto, searchSaveSelected } from "@alliance/shared/client";
import {
  getSearchCategoriesWithItems,
  getSearchSecondaryText,
  SEARCH_CATEGORY_NAMES,
  useSearchResults,
} from "@alliance/shared/lib/search";
import { cn } from "@alliance/shared/styles/util";
import { RelativePathString, router } from "expo-router";
import { Search } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  Linking,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import ProfileImage from "../../components/ProfileImage";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import Text, { FontWeight } from "../../components/system/Text";
import { getImageSource } from "../../lib/config";
import { getInternalRoute } from "../../lib/internalLinks";

const resolveItemImage = (image?: string): string | null => {
  if (!image) return null;
  if (
    image.startsWith("http") ||
    image.startsWith("data:") ||
    image.startsWith("file:")
  ) {
    return image;
  }
  return getImageSource(image);
};

const openWebLocation = (location: string) => {
  const url = location.startsWith("http")
    ? location
    : `https://worldalliance.org${
        location.startsWith("/") ? "" : "/"
      }${location}`;
  Linking.openURL(url).catch((err) => {
    console.error("Failed to open search destination", err);
  });
};

export default function SearchScreen() {
  const [search, setSearch] = useState("");
  const { items, itemsByCategory, selectedItem, setSelectedItem } =
    useSearchResults(search, { debounceMs: 50, autoselectFirst: true });

  const inputRef = useRef<TextInput>(null);

  const categoriesWithItems = useMemo(
    () => getSearchCategoriesWithItems(itemsByCategory),
    [itemsByCategory],
  );

  const handleChooseItem = useCallback(
    (item: SearchItemDto) => {
      void searchSaveSelected({ body: item });
      Keyboard.dismiss();
      setSearch("");
      setSelectedItem(null);

      const internalRoute = getInternalRoute(item.webAppLocation);
      if (internalRoute) {
        router.push(internalRoute as RelativePathString);
        return;
      }

      openWebLocation(item.webAppLocation);
    },
    [setSelectedItem],
  );

  const handleSubmitEditing = useCallback(() => {
    if (selectedItem) {
      handleChooseItem(selectedItem);
    }
  }, [handleChooseItem, selectedItem]);

  return (
    <View className="flex-1 bg-white">
      <SimplePageTitle title="Search" />
      <KeyboardAwareScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-4 pb-8 pt-2">
          <View>
            <View className="flex-row items-center gap-2 border border-zinc-200 rounded bg-zinc-50 px-3 py-3">
              <Search size={16} color="#71717a" />
              <TextInput
                ref={inputRef}
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={handleSubmitEditing}
                placeholder="Search for members, actions, posts..."
                placeholderTextColor="#9ca3af"
                className="flex-1 text-base text-zinc-900"
                autoFocus
                returnKeyType="go"
              />
            </View>
          </View>

          {search.length > 0 && items.length === 0 && (
            <View className="border border-zinc-200 rounded mt-3 bg-white px-3 py-2">
              <Text className="text-sm text-zinc-500">No results found</Text>
            </View>
          )}

          {items.length > 0 && (
            <View className="border border-zinc-200 rounded mt-3 bg-white overflow-hidden">
              {categoriesWithItems.map((category, categoryIndex) => (
                <View
                  key={category}
                  className={
                    categoryIndex === 0
                      ? "py-3"
                      : "border-t border-zinc-200 py-3"
                  }
                >
                  <Text
                    className="text-sm text-zinc-500 px-3 pb-2"
                    weight={FontWeight.Medium}
                  >
                    {SEARCH_CATEGORY_NAMES[category]}
                  </Text>
                  <View className="gap-y-1">
                    {itemsByCategory[category]?.map((item) => {
                      const secondaryText = getSearchSecondaryText(
                        item.secondaryData,
                      );
                      const itemImage = resolveItemImage(item.image);
                      const isSelected = selectedItem?.id === item.id;

                      return (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => handleChooseItem(item)}
                          activeOpacity={0.7}
                          className={cn(
                            "flex-row items-center gap-3 px-3 py-2 rounded",
                            isSelected && "bg-zinc-50",
                          )}
                        >
                          {item.type === "user" ? (
                            <ProfileImage
                              pfp={item.image ?? null}
                              size="small"
                            />
                          ) : itemImage ? (
                            <Image
                              source={{ uri: itemImage }}
                              className="w-8 h-8 rounded bg-zinc-100"
                              resizeMode="cover"
                            />
                          ) : (
                            <View className="w-8 h-8 rounded bg-zinc-100 border border-zinc-200" />
                          )}
                          <View className="flex-1">
                            <Text
                              className="text-zinc-900"
                              weight={FontWeight.Medium}
                            >
                              {item.name}
                            </Text>
                            {secondaryText.length > 0 && (
                              <Text className="text-xs text-zinc-500 mt-0.5">
                                {secondaryText}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

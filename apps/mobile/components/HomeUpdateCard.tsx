import type { ActionUpdateDto } from "@alliance/shared/client";
import { useUpdateCardContent } from "@alliance/shared/lib/actionUpdateCard";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import { router } from "expo-router";
import { ArrowRight, ClipboardList, Layers } from "lucide-react-native";
import { memo, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { resolveImageSource } from "../lib/config";
import { colors } from "../lib/style/colors";
import ProfileImage from "./ProfileImage";
import Text, { FontWeight } from "./system/Text";

function facepileSize(cardWidth: number): number {
  if (cardWidth >= 340) return 3;
  return cardWidth >= 300 ? 2 : 0;
}

const HomeUpdateCard = memo(function HomeUpdateCard({
  update,
  isNew,
  onOpen,
}: {
  update: ActionUpdateDto;
  isNew: boolean;
  onOpen: (updateId: number) => void;
}) {
  const { tiles, hiddenCount, excerpt, participated, markFailed } =
    useUpdateCardContent(update);
  const [cardWidth, setCardWidth] = useState(0);
  const pictures = (update.participantPictures ?? []).slice(
    0,
    facepileSize(cardWidth),
  );

  return (
    <Pressable
      onPress={() => {
        onOpen(update.id);
        router.push(`/actions/${update.actionId}`);
      }}
      onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}
      accessibilityRole="link"
      className="flex-1 overflow-hidden rounded-md border border-zinc-200 bg-white"
    >
      <View
        className={cn(
          "w-full gap-0.5 overflow-hidden bg-zinc-100",
          tiles.length > 1 && "flex-row",
        )}
        style={{ aspectRatio: 3 / 2 }}
      >
        {tiles.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ClipboardList size={40} color={colors.text.light} />
          </View>
        ) : tiles.length >= 3 ? (
          <>
            <MosaicTile
              cover={tiles[0]}
              onError={markFailed}
              className="flex-[2]"
            />
            <View className="flex-1 gap-0.5">
              {tiles.slice(1).map((cover, position) => (
                <MosaicTile
                  key={cover.src}
                  cover={cover}
                  onError={markFailed}
                  hiddenCount={position === 1 ? hiddenCount : 0}
                  className="flex-1"
                />
              ))}
            </View>
          </>
        ) : (
          tiles.map((cover) => (
            <MosaicTile
              key={cover.src}
              cover={cover}
              onError={markFailed}
              className="flex-1"
            />
          ))
        )}
        <View className="absolute left-2.5 right-2.5 top-2.5 flex-row items-start justify-between gap-2">
          <View className="rounded bg-white/90 px-2 py-0.5">
            <Text
              className="text-sm text-zinc-700"
              weight={FontWeight.Semibold}
            >
              {formatTime(new Date(update.date), { addSuffix: true })}
            </Text>
          </View>
          {isNew && (
            <View className="rounded bg-green-50 px-2 py-0.5">
              <Text
                className="text-sm text-green-800"
                weight={FontWeight.Semibold}
              >
                New
              </Text>
            </View>
          )}
        </View>
      </View>
      <View className="flex-1 gap-2 p-4">
        <View className="flex-row items-center gap-1.5">
          <Layers size={16} color={colors.text.tertiary} />
          <Text
            className="flex-1 text-sm text-zinc-500"
            weight={FontWeight.Medium}
            numberOfLines={1}
          >
            {update.actionName}
          </Text>
        </View>
        <Text
          className="text-lg leading-snug text-zinc-900"
          weight={FontWeight.Semibold}
          numberOfLines={2}
        >
          {update.title}
        </Text>
        {excerpt && (
          <Text className="text-zinc-600" numberOfLines={3}>
            {excerpt}
          </Text>
        )}
        <View className="mt-auto flex-row items-center gap-2 border-t border-zinc-100 pt-3">
          {participated && (
            <View className="flex-1 flex-row items-center gap-1.5">
              {pictures.length > 0 && (
                <View
                  className="flex-row items-center"
                  importantForAccessibility="no-hide-descendants"
                  accessibilityElementsHidden
                >
                  {pictures.map((picture, position) => (
                    <View
                      key={picture}
                      className="rounded border-2 border-white"
                      style={{ marginLeft: position > 0 ? -10 : 0 }}
                    >
                      <ProfileImage pfp={picture} size="small" />
                    </View>
                  ))}
                </View>
              )}
              <Text className="flex-1 text-sm text-zinc-500" numberOfLines={1}>
                {participated}
              </Text>
            </View>
          )}
          <View className="ml-auto flex-row items-center gap-1">
            <Text
              className="text-sm text-zinc-900"
              weight={FontWeight.Semibold}
            >
              Read
            </Text>
            <ArrowRight size={16} color={colors.text.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
});

function MosaicTile({
  cover,
  onError,
  hiddenCount = 0,
  className,
}: {
  cover: { src: string; alt: string };
  onError: (src: string) => void;
  hiddenCount?: number;
  className?: string;
}) {
  return (
    <View className={cn("overflow-hidden", className)}>
      <Image
        source={{ uri: resolveImageSource(cover.src) }}
        onError={() => onError(cover.src)}
        accessibilityLabel={cover.alt}
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      />
      {hiddenCount > 0 && (
        <View
          className="absolute inset-0 items-center justify-center bg-black/50"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Text className="text-lg text-white" weight={FontWeight.Bold}>
            +{hiddenCount}
          </Text>
        </View>
      )}
    </View>
  );
}

export default HomeUpdateCard;

import { type ImagesItem } from "@alliance/common/forms/display-blocks";
import { cn } from "@alliance/shared/styles/util";
import { Download } from "lucide-react-native";
import { useState } from "react";
import { Image, ScrollView, TouchableOpacity, View } from "react-native";
import { resolveImageSource } from "../../lib/config";
import { getImageLoadSize } from "../../lib/imageLoadSize";
import { saveImage } from "../../lib/saveImage";
import { ImageGalleryModal } from "../ImageLightbox";
import Text from "../system/Text";

function DownloadButton({ uri, name }: { uri: string; name?: string }) {
  const [saving, setSaving] = useState(false);

  const handlePress = async () => {
    setSaving(true);
    await saveImage({ uri, name });
    setSaving(false);
  };

  return (
    <TouchableOpacity
      onPress={() => void handlePress()}
      disabled={saving}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Download image"
      accessibilityState={{ busy: saving }}
      className={cn(
        "absolute right-2 top-2 rounded-full bg-white/80 p-1.5",
        saving && "opacity-50",
      )}
    >
      <Download size={16} className="text-zinc-800" />
    </TouchableOpacity>
  );
}

function ImageSlide({
  image,
  resolvedSrc,
  width,
  aspectRatio,
  onPress,
  onMeasure,
  downloadable,
}: {
  image: ImagesItem;
  resolvedSrc: string;
  width: number | null;
  aspectRatio: number | null;
  onPress: () => void;
  onMeasure: (ratio: number) => void;
  downloadable: boolean;
}) {
  const widthStyle = width === null ? {} : { width };
  const fullWidthClass = width === null && "w-full";

  return (
    <View style={widthStyle} className="items-center">
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={widthStyle}
        className={cn(fullWidthClass)}
      >
        <Image
          source={{ uri: resolvedSrc }}
          accessibilityLabel={image.alt}
          onLoad={(event) => {
            const size = getImageLoadSize(event);
            if (size) onMeasure(size.width / size.height);
          }}
          className={cn("bg-zinc-200 rounded-lg", fullWidthClass)}
          style={{
            ...widthStyle,
            ...(aspectRatio ? { aspectRatio } : { height: 192 }),
          }}
          resizeMode="contain"
        />
      </TouchableOpacity>
      {downloadable && (
        <DownloadButton uri={resolvedSrc} name={image.fileName} />
      )}
      {image.caption ? (
        <Text className="text-sm text-zinc-600 mt-2 text-center">
          {image.caption}
        </Text>
      ) : null}
    </View>
  );
}

export default function ImagesDisplay({
  images,
  downloadable,
}: {
  images: ImagesItem[];
  downloadable: boolean;
}) {
  const sources = images.map((image) => resolveImageSource(image.src));
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Keyed by slide rather than indexed into an array, because images finish
  // loading out of order and a sparse array would put holes in the `Math.min`.
  const [measuredAspectRatios, setMeasuredAspectRatios] = useState<
    Record<number, number>
  >({});

  // One height for every slide, taken from the tallest image loaded so far, so
  // swiping doesn't resize the block under the reader's finger. `contain`
  // letterboxes the wider ones rather than cropping them.
  const measured = Object.values(measuredAspectRatios);
  const aspectRatio = measured.length ? Math.min(...measured) : null;

  const measureSlide = (slide: number) => (ratio: number) =>
    setMeasuredAspectRatios((current) => ({ ...current, [slide]: ratio }));

  const lightbox = (
    <ImageGalleryModal
      uris={sources}
      index={lightboxIndex}
      onClose={() => setLightboxIndex(null)}
    />
  );

  if (images.length === 1) {
    return (
      <View>
        <ImageSlide
          image={images[0]}
          resolvedSrc={sources[0]}
          width={null}
          aspectRatio={aspectRatio}
          onPress={() => setLightboxIndex(0)}
          onMeasure={measureSlide(0)}
          downloadable={downloadable}
        />
        {lightbox}
      </View>
    );
  }

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) =>
          setIndex(
            width ? Math.round(event.nativeEvent.contentOffset.x / width) : 0,
          )
        }
      >
        {images.map((image, slide) => (
          <ImageSlide
            key={slide}
            image={image}
            resolvedSrc={sources[slide]}
            width={width}
            aspectRatio={aspectRatio}
            onPress={() => setLightboxIndex(slide)}
            onMeasure={measureSlide(slide)}
            downloadable={downloadable}
          />
        ))}
      </ScrollView>

      <View className="flex-row justify-center gap-1.5 mt-2">
        {images.map((_, dot) => (
          <View
            key={dot}
            className={cn(
              "h-2 w-2 rounded-full",
              dot === index ? "bg-zinc-700" : "bg-zinc-300",
            )}
          />
        ))}
      </View>

      {lightbox}
    </View>
  );
}

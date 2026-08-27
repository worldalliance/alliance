import { ImageZoom } from "@likashefqet/react-native-image-zoom";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Text, { TextStyle } from "./system/Text";

function ZoomableImage({ uri, onClose }: { uri: string; onClose: () => void }) {
  return (
    <ImageZoom
      uri={uri}
      minScale={1}
      maxScale={5}
      isDoubleTapEnabled
      isSingleTapEnabled
      onSingleTap={onClose}
      style={{ flex: 1 }}
      resizeMode="contain"
    />
  );
}

interface ImageLightboxModalProps {
  uri: string | null;
  onClose: () => void;
}

export function ImageLightboxModal({ uri, onClose }: ImageLightboxModalProps) {
  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView className="flex-1 bg-black/80">
        {uri ? (
          <ZoomableImage uri={uri} onClose={onClose} />
        ) : (
          <Pressable onPress={onClose} className="flex-1" />
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

interface ImageGalleryModalProps {
  uris: string[];
  index: number | null;
  onClose: () => void;
}

export function ImageGalleryModal({
  uris,
  index,
  onClose,
}: ImageGalleryModalProps) {
  return (
    <Modal
      visible={index !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView className="flex-1 bg-black/80">
        {index === null ? (
          <Pressable onPress={onClose} className="flex-1" />
        ) : (
          // Closing unmounts this, so each open starts a fresh pager sitting
          // on the tapped image.
          <Gallery uris={uris} initialIndex={index} onClose={onClose} />
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

function Gallery({
  uris,
  initialIndex,
  onClose,
}: {
  uris: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(initialIndex);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!width) return;
    scrollRef.current?.scrollTo({ x: initialIndex * width, animated: false });
  }, [width, initialIndex]);

  // ImageZoom claims one-finger drags only after zooming, so the pager still
  // receives swipes at scale 1.
  return (
    <View
      className="flex-1"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        // The row of slides has to fill the modal's height for each slide to
        // stretch into it; a slide sizes itself only across the pager.
        contentContainerStyle={{ flexGrow: 1 }}
        onScroll={(event) =>
          setPage(
            width ? Math.round(event.nativeEvent.contentOffset.x / width) : 0,
          )
        }
      >
        {uris.map((uri, slide) => (
          <View key={slide} style={{ width }}>
            <ZoomableImage uri={uri} onClose={onClose} />
          </View>
        ))}
      </ScrollView>

      {uris.length > 1 && (
        <View className="absolute top-14 left-0 right-0 items-center">
          <View className="rounded-full bg-black/50 px-3 py-1">
            <Text type={TextStyle.Label} className="text-sm">
              {page + 1} / {uris.length}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

interface ImageLightboxProps {
  uris: string[];
  thumbnailClassName?: string;
}

export default function ImageLightbox({
  uris,
  thumbnailClassName = "w-36 h-36 rounded",
}: ImageLightboxProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      {uris.map((uri, idx) => (
        <TouchableOpacity
          key={`${uri}-${idx}`}
          onPress={() => setLightboxIndex(idx)}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri }}
            className={thumbnailClassName}
            resizeMode="cover"
          />
        </TouchableOpacity>
      ))}
      <ImageGalleryModal
        uris={uris}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}

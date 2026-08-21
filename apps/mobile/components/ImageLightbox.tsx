import { ImageZoom } from "@likashefqet/react-native-image-zoom";
import { useState } from "react";
import { Image, Modal, Pressable, TouchableOpacity } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

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
        ) : (
          <Pressable onPress={onClose} className="flex-1" />
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

interface ImageLightboxProps {
  uris: string[];
  thumbnailClassName?: string;
}

export default function ImageLightbox({
  uris,
  thumbnailClassName = "w-24 h-24 rounded",
}: ImageLightboxProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxSrc = lightboxIndex !== null ? uris[lightboxIndex] : null;

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
      <ImageLightboxModal
        uri={lightboxSrc}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}

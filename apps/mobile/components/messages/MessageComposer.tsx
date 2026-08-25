import { MessageDto } from "@alliance/shared/client";
import { photoPickFailed, unreadablePhotos } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import { ImagePlus, Send, X } from "lucide-react-native";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { pickImageDataUris } from "../../lib/pickImageDataUri";
import { colors } from "../../lib/style/colors";
import Text from "../system/Text";

interface MessageComposerProps {
  message: string;
  setMessage: (value: string) => void;
  attachments: string[];
  setAttachments: Dispatch<SetStateAction<string[]>>;
  onSend: () => Promise<void>;
  isSending?: boolean;
  replyingTo?: MessageDto | null;
  clearReplyingTo?: () => void;
  placeholder?: string;
  inputRef?: React.RefObject<TextInput | null>;
}

export default function MessageComposer({
  message,
  inputRef,
  setMessage,
  attachments,
  setAttachments,
  onSend,
  isSending = false,
  replyingTo,
  clearReplyingTo,
  placeholder = "Message",
}: MessageComposerProps) {
  const [picking, setPicking] = useState(false);
  const canSend = message.trim().length > 0 || attachments.length > 0;

  const handlePickImages = useCallback(async () => {
    if (picking) return;
    setPicking(true);
    try {
      const picked = await pickImageDataUris();
      if (!picked.ok) {
        console.error("Failed to pick images", picked.error);
        Alert.alert("Couldn't add photos", photoPickFailed);
        return;
      }
      const { dataUris, unreadableCount } = picked.value;
      if (unreadableCount > 0) {
        Alert.alert(
          "Couldn't add photos",
          unreadablePhotos(unreadableCount, unreadableCount + dataUris.length),
        );
      }
      if (dataUris.length > 0) {
        setAttachments((prev) => [...prev, ...dataUris]);
      }
    } finally {
      setPicking(false);
    }
  }, [picking, setAttachments]);

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSend = useCallback(() => {
    if (!canSend || isSending) return;
    onSend();
  }, [canSend, isSending, onSend]);

  return (
    <KeyboardStickyView
      className="border-t border-zinc-200 bg-white px-4 py-3"
      offset={{ closed: 0, opened: 90 }}
    >
      {replyingTo && (
        <View className="flex-row items-center justify-between bg-zinc-100 rounded p-3 mb-3">
          <View className="flex-row items-center gap-2 flex-1">
            <Text className="text-sm text-zinc-500">Replying to:</Text>
            <Text
              className="text-sm text-zinc-900 max-w-[250px]"
              numberOfLines={1}
            >
              {replyingTo.body || "image"}
            </Text>
          </View>
          {clearReplyingTo && (
            <TouchableOpacity onPress={clearReplyingTo}>
              <X size={16} color={colors.text.icon} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {attachments.length > 0 && (
        <View className="flex-row flex-wrap gap-2 mb-3">
          {attachments.map((attachment, index) => (
            <View
              key={`${attachment.slice(0, 12)}-${index}`}
              className="relative"
            >
              <Image
                source={{ uri: attachment }}
                className="w-16 h-16 rounded border border-zinc-200"
              />
              <TouchableOpacity
                onPress={() => handleRemoveAttachment(index)}
                className="absolute -top-2 -right-2 bg-black/70 rounded-full w-5 h-5 items-center justify-center"
              >
                <Text className="text-white text-xs">×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View className="flex-row items-end gap-2">
        <TouchableOpacity
          onPress={handlePickImages}
          className="items-center justify-center rounded border border-zinc-200 p-2"
          disabled={picking}
        >
          <ImagePlus size={21} color={colors.text.secondary} />
        </TouchableOpacity>
        <View className="flex-1 border border-zinc-200 rounded bg-zinc-50 px-3 py-2 min-h-10 justify-center">
          <TextInput
            ref={inputRef}
            value={message}
            onChangeText={setMessage}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            multiline
            className="text-base text-zinc-900"
            textAlignVertical="center"
            style={{ paddingVertical: 0 }}
            autoFocus
          />
        </View>
        <TouchableOpacity
          onPress={handleSend}
          className={cn(
            "w-10 h-10 items-center justify-center rounded",
            canSend ? "bg-green" : "bg-zinc-300",
          )}
          disabled={!canSend || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Send size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardStickyView>
  );
}

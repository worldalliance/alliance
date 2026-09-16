import { type PropsWithChildren } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface FormModalProps {
  visible: boolean;
  onClose: () => void;
  animationType?: "none" | "fade" | "slide";
  /** Off for content holding its own virtualized list. */
  scrolls?: boolean;
}

function FormModal({
  visible,
  onClose,
  animationType = "fade",
  scrolls = true,
  children,
}: PropsWithChildren<FormModalProps>) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType={animationType}>
      {/* Backdrop */}
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/50 justify-end"
        style={{ paddingTop: insets.top }}
      >
        <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={-50}>
          {/* Prevent backdrop press from closing when tapping content */}
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="bg-white rounded-t-2xl px-5 pt-5 pb-15">
              {scrolls ? (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                  showsVerticalScrollIndicator={false}
                >
                  {children}
                </ScrollView>
              ) : (
                children
              )}
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

export default FormModal;

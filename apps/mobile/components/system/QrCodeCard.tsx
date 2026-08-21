import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import Text from "./Text";

export type QrCodeCardProps = {
  /** URL or value to encode. When null, shows emptyMessage instead of QR. */
  value: string | null;
  size?: number;
  /** Caption shown below the QR when value is present. */
  caption?: string;
  /** Message shown when value is null. */
  emptyMessage?: string;
  /** Optional container class name. */
  className?: string;
};

const DEFAULT_SIZE = 300;

export default function QrCodeCard({
  value,
  size = DEFAULT_SIZE,
  caption,
  emptyMessage,
  className,
}: QrCodeCardProps) {
  return (
    <View className={`items-center gap-4 ${className ?? ""}`}>
      {value ? (
        <>
          <View className="bg-white p-4 rounded-xl">
            <QRCode value={value} size={size} />
          </View>
          {caption != null && caption !== "" && (
            <Text className="text-base text-zinc-600 text-center">
              {caption}
            </Text>
          )}
        </>
      ) : (
        emptyMessage != null &&
        emptyMessage !== "" && (
          <Text className="text-sm text-zinc-500 text-center">
            {emptyMessage}
          </Text>
        )
      )}
    </View>
  );
}

import { referralQrCopy } from "@alliance/shared/lib/copy";
import { View } from "react-native";
import QrCodeCard from "./system/QrCodeCard";

export type ReferralQrSectionProps = {
  /** User's referral signup URL, or null if not available. */
  referralLink: string | null;
  /** Optional QR size. */
  size?: number;
};

export default function ReferralQrSection({
  referralLink,
  size,
}: ReferralQrSectionProps) {
  return (
    <View className="items-center py-6 gap-4">
      <QrCodeCard
        value={referralLink}
        size={size}
        caption={referralQrCopy.caption}
        emptyMessage={referralQrCopy.linkUnavailable}
      />
    </View>
  );
}

import { deviceTimeZoneOffer } from "@alliance/shared/forms/deviceTimeZoneOffer";
import { deviceTimeZone } from "@alliance/shared/lib/timeZone";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useState } from "react";

type Props = {
  saved: string | undefined;
  onUse: (tz: string) => void;
};

export default function DeviceTimeZoneOffer({ saved, onUse }: Props) {
  const [device] = useState(deviceTimeZone);
  const offer = deviceTimeZoneOffer({ saved, device });
  if (!offer) return null;
  return (
    <div className="flex items-center gap-x-3 mt-2 text-sm text-zinc-600 font-normal">
      <span>Device timezone: {offer.label}</span>
      <Button
        onClick={() => onUse(offer.tz)}
        color={ButtonColor.Outline}
        size="small"
        className="shrink-0"
      >
        Use
      </Button>
    </div>
  );
}

import {
  ShareLinkTargetKind,
  useShareLink,
} from "@alliance/shared/forms/useShareLink";
import { useAppOrigin } from "@alliance/sharedweb/lib/appOrigin";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import { Clock } from "lucide-react";
import { generateBarcodeUrl } from "../../lib/utils";

const AIPrivacyFlyer: React.FC = () => {
  const publicActionId = 55;
  const { data: shareUrl } = useShareLink({
    kind: ShareLinkTargetKind.Action,
    actionId: publicActionId,
  });
  const origin = useAppOrigin(getBaseUrl());
  const qrCodeUrl = shareUrl ? generateBarcodeUrl(shareUrl, 200) : "";

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex flex-col gap-y-[0.2in]">
        <h1 className="text-[0.35in] font-bold font-serif ">
          Participate in a survey on ethical AI privacy settings
        </h1>

        <div className="flex flex-row items-center gap-x-[0.08in] bg-green text-white py-[0.05in] px-[0.15in] self-start rounded-lg">
          <Clock className="w-[0.2in] h-[0.2in]" />

          <p className="text-[0.2in] font-semibold">
            This survey will take about 5 minutes
          </p>
        </div>

        <p className="text-[0.2in]">
          We are running a survey to understand whether people are aware of how
          tech companies use their data for AI training.{" "}
        </p>

        <div className="flex flex-col gap-y-[0.1in]">
          <p className="font-semibold text-green text-[0.25in]">
            Benefits of participating
          </p>
          <ol className="text-[0.2in]">
            <li>
              <span className="font-semibold">1. Control your data:</span> The
              survey will walk you through your privacy settings for various
              tech companies so you can decide how your data is used.
            </li>
            <li>
              <span className="font-semibold">
                2. Help with privacy advocacy:
              </span>{" "}
              Depending on what respondents say, we will conduct a follow-up
              campaign advocating for changes in data use practices.
            </li>
          </ol>
        </div>
      </div>

      <div className="flex flex-col items-center mx-auto gap-y-[0.1in]">
        {qrCodeUrl ? (
          <img src={qrCodeUrl} alt="QR Code" className="w-[2.5in] h-[2.5in]" />
        ) : (
          "Loading QR code..."
        )}

        <p className="text-[0.2in] text-zinc-500 text-center">{origin}/</p>
      </div>

      <p className="text-[0.2in] text-zinc-500">
        This experiment is run by the Alliance, an online community taking
        weekly actions to improve the world.
      </p>
    </div>
  );
};

export default AIPrivacyFlyer;

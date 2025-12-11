import { Clock } from "lucide-react";
import { generateBarcodeUrl } from "../../lib/utils";

interface AIPrivacyFlyerProps {
  url: string;
}

const AIPrivacyFlyer: React.FC<AIPrivacyFlyerProps> = ({
  url,
}: AIPrivacyFlyerProps) => {
  const qrCodeUrl = generateBarcodeUrl(url, 200);
  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex flex-col gap-y-[0.2in]">
        <h1 className="text-[0.35in] font-bold font-serif">
          Participate in an experiment on ethical AI privacy settings
        </h1>

        <div className="flex flex-row items-center gap-x-[0.08in] bg-green text-white py-[0.05in] px-[0.15in] self-start rounded-lg">
          <Clock className="w-[0.2in] h-[0.2in]" />

          <p className="text-[0.2in] font-semibold">
            This survey will take about 5 minutes.
          </p>
        </div>

        <p className="text-[0.2in]">
          We are running a survey to understand how people prefer AI companies
          use their data.{" "}
        </p>

        <div className="flex flex-col gap-y-[0.1in]">
          <p className="font-semibold text-green text-[0.25in]">
            Benefits of participating
          </p>
          <ol className="text-[0.2in]">
            <li>
              <span className="font-semibold">1. Control your data:</span> The
              survey will help you control your data by walking you through
              relevant privacy settings of various tech companies.
            </li>
            <li>
              <span className="font-semibold">
                2. Help with privacy advocacy:
              </span>{" "}
              Depending on what you and others say, we will conduct a follow-up
              campaign advocating for changes in data use practices.
            </li>
          </ol>
        </div>
      </div>

      <div className="flex flex-col items-center mx-auto gap-y-[0.1in]">
        <img src={qrCodeUrl} alt="QR Code" className="w-[2.5in] h-[2.5in]" />
        <p className="text-[0.2in] text-zinc-500 text-center">{url}</p>
      </div>

      <p className="text-[0.2in] text-zinc-500">
        This experiment is run by the Alliance, an online community taking
        weekly actions to improve the world.
      </p>
    </div>
  );
};

export default AIPrivacyFlyer;

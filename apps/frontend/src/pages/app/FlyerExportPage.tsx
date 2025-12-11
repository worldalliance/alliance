import CenterLayout from "@alliance/shared/ui/CenterLayout";
import ExportableFlyer from "../../components/ExportableFlyer";
import AIPrivacyFlyer from "../../components/flyers/AIPrivacyFlyer";

const FlyerExportPage: React.FC = () => {
  return (
    <CenterLayout>
      <h1 className="text-2xl font-semibold font-serif mb-2">
        Export custom flyer
      </h1>

      <p className="text-zinc-500 mb-4">
        This flyer may contain custom content, such as a QR code, that is unique
        to your account.
      </p>

      <ExportableFlyer filename="ai-privacy-flyer.pdf">
        <AIPrivacyFlyer url="https://worldalliance.org" />
      </ExportableFlyer>
    </CenterLayout>
  );
};

export default FlyerExportPage;

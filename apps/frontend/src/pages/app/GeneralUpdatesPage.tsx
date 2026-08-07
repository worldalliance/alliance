import { useAllGeneralUpdates } from "@alliance/shared/lib/useGeneralUpdates";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import LargeGeneralUpdateCard from "@alliance/sharedweb/ui/LargeGeneralUpdateCard";
import { MoveLeft } from "lucide-react";
import React from "react";
import { Link, href } from "react-router";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";

const GeneralUpdatesPage: React.FC = () => {
  useWhiteBackground();

  const { generalUpdates } = useAllGeneralUpdates();

  return (
    <CenterLayout>
      <div className="gap-y-4 flex flex-col text-base md:text-lg">
        <Link to={href("/information")} className="text-link self-start">
          <div className="flex flex-row items-center gap-x-2">
            <MoveLeft size={14} /> Information
          </div>
        </Link>
        <h1 className="text-title">General updates</h1>

        <div className="flex flex-col gap-y-4 text-base">
          {generalUpdates.map((generalUpdate) => (
            <LargeGeneralUpdateCard
              key={generalUpdate.id}
              title={generalUpdate.name}
              schema={generalUpdate.schema}
            />
          ))}
        </div>
      </div>
    </CenterLayout>
  );
};

export default GeneralUpdatesPage;

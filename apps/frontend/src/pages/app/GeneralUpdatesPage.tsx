import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, href } from "react-router";
import { actionsAllGeneralUpdates } from "@alliance/shared/client";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import LargeGeneralUpdateCard from "@alliance/sharedweb/ui/LargeGeneralUpdateCard";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import { ArrowLeft } from "lucide-react";

const GeneralUpdatesPage: React.FC = () => {
  useWhiteBackground();

  const { data: generalUpdates = [] } = useQuery({
    queryKey: ["actionsAllGeneralUpdates"],
    queryFn: () =>
      actionsAllGeneralUpdates().then((response) => response.data ?? []),
  });

  return (
    <CenterLayout>
      <div className="gap-y-4 flex flex-col text-base md:text-lg">
        <Link to={href("/information")} className="text-link self-start">
          <div className="flex flex-row items-center gap-x-2">
            <ArrowLeft size={14} /> Information
          </div>
        </Link>
        <p className="font-serif text-3xl md:text-4xl font-semibold mb-4">
          General updates
        </p>

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

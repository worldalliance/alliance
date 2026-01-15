import React from "react";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import { href } from "react-router";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import ResourceButton from "../../components/ResourceButton";
import ActionUpdateCard from "@alliance/sharedweb/ui/ActionUpdateCard";
import { useActionUpdates } from "@alliance/shared/lib/informationPage";

const InformationPage: React.FC = () => {
  useWhiteBackground();

  const { updates, error } = useActionUpdates();

  return (
    <CenterLayout>
      <div className="md:mt-8 gap-y-4 flex flex-col text-base md:text-lg">
        <p className="font-serif text-3xl md:text-4xl font-semibold mb-4">
          Information
        </p>

        <h2 className="text-2xl font-semibold">Resources</h2>

        <div className="grid grid-cols-2 gap-x-2 gap-y-2">
          <ResourceButton to={href("/guide")}>
            <p className="text-base">Guide</p>
          </ResourceButton>
          <ResourceButton to={href("/foundation")}>
            <p className="text-base">Foundation</p>
          </ResourceButton>
          <ResourceButton to={href("/governance")}>
            <p className="text-base">Governance</p>
          </ResourceButton>
          <ResourceButton to={href("/faq")}>
            <p className="text-base">FAQ</p>
          </ResourceButton>
          <ResourceButton to={href("/members")}>
            <p className="text-base">Members</p>
          </ResourceButton>
          <ResourceButton to="mailto:contact@worldalliance.org">
            <p className="text-base">Email the office</p>
          </ResourceButton>
        </div>

        <h2 className="text-2xl font-semibold mt-4">Action updates</h2>

        <div className="flex flex-col gap-y-4 text-base">
          {updates
            .sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
            .map((update) => (
              <ActionUpdateCard
                key={update.id}
                update={update}
                onActionPageTimeline={false}
              />
            ))}
          {error && <p className="text-zinc-500">{error}</p>}
        </div>
      </div>
    </CenterLayout>
  );
};

export default InformationPage;

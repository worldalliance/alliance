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

        <div className="flex flex-col mt-4">
          <h2 className="text-2xl font-semibold">Roadmap</h2>
          <p className="text-zinc-500">Last updated 1/29/2026</p>
        </div>
        <div className="flex flex-col gap-y-2">
          <p>
            We are in an experimental, invite-only phase. We are working up to a
            public launch in which we will allow anyone to join the Alliance. In
            general, this preparation entails:
          </p>

          <ul className="list-disc list-inside">
            <li>
              <span className="font-semibold">
                Ensuring that our action production process is smooth and
                reliable.
              </span>{" "}
              This includes understanding what makes actions effective and,
              eventually, hiring experts in fields relevant to our priorities.
            </li>
            <li>
              <span className="font-semibold">
                Building organizational structures and processes that help
                members contribute reliably and straightforwardly.
              </span>{" "}
              This includes designing Alliance groups and determining our
              governance procedures.
            </li>
            <li>
              <span className="font-semibold">
                Developing a functional and accessible online platform.
              </span>{" "}
              This includes improving our platform based on early members&apos;
              feedback and testing it with a wider, more global audience.
            </li>
          </ul>
        </div>
        <div className="flex flex-col mt-4">
          <p>Right now, the office is:</p>
          <ul className="list-disc list-inside">
            <li>
              Streamlining the process of leading and joining groups so that we
              can accommodate more members.
            </li>
            <li>Developing a mobile app.</li>
            <li>
              Moving important notifications to the homepage for greater
              visibility.
            </li>
            <li>Hiring and fundraising.</li>
          </ul>
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

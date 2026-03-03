import React from "react";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";

import InfoSubpage from "../../components/InfoSubpage";
import ExampleActionCategoryList from "../../components/ExampleActionCategoryList";

const RoadmapPage: React.FC = () => {
  useWhiteBackground();

  const tocSections = [
    { id: "experimental-phase", label: "Experimental phase", level: 2 },
    { id: "public-launch", label: "Public launch", level: 2 },
    { id: "current-activities", label: "Current activities", level: 2 },
  ];

  return (
    <InfoSubpage tocSections={tocSections}>
      <p className="text-zinc-500">Last updated: February 25, 2026</p>
      <section className="gap-y-4 flex flex-col">
        <h1
          id="roadmap"
          className="font-serif text-3xl md:text-4xl font-semibold mb-4 text-black"
        >
          Roadmap
        </h1>
        <h2
          id="experimental-phase"
          className="mt-2 text-2xl font-semibold text-black"
        >
          Experimental phase
        </h2>
        <p>
          We are in an experimental, invite-only phase, in which our primary
          focus is learning.
        </p>
        <p>
          We are working up to a public launch, after which we will allow anyone
          to join the Alliance. After launch, our primary focus will be impact.
        </p>
        <p>
          Our pre-launch preparation includes developing the following
          components:
        </p>
        <ul className="list-disc list-inside pl-4 space-y-2">
          <li>
            <span className="font-semibold">A robust action pipeline.</span> We
            are learning what makes actions effective and building a global team
            with relevant expertise.
          </li>
          <li>
            <span className="font-semibold">
              Community structures and processes.
            </span>{" "}
            We are creating a community that effectively invites and onboards
            new members, as well as helps existing members contribute reliably.
          </li>
          <li>
            <span className="font-semibold">
              A functional and accessible online platform.
            </span>{" "}
            We are improving our platform based on member feedback and testing
            with a broad global audience.
          </li>
        </ul>
        <p>
          We anticipate that this phase will last for at least another 6 months.
        </p>
      </section>
      <section className="gap-y-4 flex flex-col">
        <h2 id="public-launch" className="text-2xl font-semibold text-black">
          Public launch
        </h2>
        <p>
          After we launch publicly, our actions will primarily aim to make rapid
          and significant progress on our priorities. This will involve:
        </p>
        <ul className="list-disc list-inside pl-4 space-y-2">
          <li>Growing our membership quickly and strategically.</li>
          <li>
            Developing an expert-informed, member-approved plan that guides our
            actions in the long term.
          </li>
        </ul>
        <p>
          Eventually, we hope to help millions, or hundreds of millions, of
          people around the world coordinate effectively and routinely.
        </p>
        <p>
          A large, global member body will multiply our impact. We will also be
          able to coordinate in more complex ways. For instance, different
          cohorts of members – depending on skills, interests, and demographics
          – could be asked to pressure their local governments in different
          ways.
        </p>
        <p>
          We cannot yet describe the precise actions that we will take at
          various scales, as this will require both expert involvement and
          learned experience. However, we expect many future actions to fall
          into the following categories:
        </p>
        <ExampleActionCategoryList />
      </section>
      <section className="gap-y-4 flex flex-col">
        <h2
          id="current-activities"
          className="mt-2 text-2xl font-semibold text-black"
        >
          Current activities
        </h2>
        <p>Right now, the office is:</p>
        <ul className="list-disc list-inside pl-4 space-y-2">
          <li>Planning weekly actions that test specific hypotheses.</li>
          <li>
            Developing processes so that group leads can help and communicate
            with other group leads.
          </li>
          <li>Developing a mobile app.</li>
          <li>Reorganizing our information and action pages.</li>
          <li>
            Piloting videos and textual updates that help members better
            understand the Alliance.
          </li>
          <li>Hiring.</li>
        </ul>
      </section>
    </InfoSubpage>
  );
};

export default RoadmapPage;

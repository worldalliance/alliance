import React from "react";
import { Link, href } from "react-router";
import Footer from "../../components/Footer";
import MarkdownWrapper from "../../components/MarkdownWrapper";
import MemberContract from "../../components/MemberContract";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";

const GovernancePage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex flex-col md:flex-row mx-2 sm:mx-4 md:mx-12 pt-8 md:pt-32 pb-56 justify-center">
        <div className="flex flex-col gap-y-4 max-w-184">
          <h1 className="text-title-large">Governance</h1>
          <p className="text-lg text-zinc-500">
            The following governance procedures were{" "}
            <Link
              to={href("/progress/:slug", { slug: "early-governance" })}
              className="text-link"
            >
              developed and approved
            </Link>{" "}
            by 25 founding members of the Alliance.
          </p>

          <div className="flex flex-col gap-y-6 mt-8">
            <MarkdownWrapper
              id="foundation"
              className=""
              markdownContent="
## Membership
Members of the Alliance are individuals that have signed and abide by the following membership contract. 

"
            />

            <MemberContract id="contract" className="bg-white p-6" />

            <MarkdownWrapper
              id="foundation-2"
              markdownContent="

This membership contract may be revised with signed members’ consent.

Additional membership contracts can be offered at the office’s discretion.

## Strategic office
The office of the Alliance is the set of members responsible for ensuring the Alliance will fulfill its purpose given that members abide by their contracts.

In particular, the office is responsible for:
1. The development of and maintenance of a plan for the Alliance.
2. The decomposition of this plan into tasks.
3. The assignment and delivery of these tasks to members. As per the terms of the current membership contract, the office assigns each 15-minute block of tasks a 7-day window that does not overlap with the 7-day window of any other block.

In designing actions, the office aims to satisfy both:
1. The collective interests of members, as can be reasonably determined through internal democratic processes.
2. The collective interests of humanity, as can be reasonably determined using available data about global preferences.

## Oversight
These procedures are in effect until they are modified by a governance review process that requires the participation of all members. The office will schedule this review process at its discretion.

The Alliance meets its approval threshold when more than 3/4 of members indicate that they want the Alliance to continue to operate as it currently does.

To ensure the Alliance meets its approval threshold, the office will run a periodic oversight process. During an oversight process, the office will:

1. Conduct a membership-wide survey to evaluate if the Alliance meets its approval threshold.
2. If it does not, then the office will stop planning and running all actions until it changes how it operates.

The office will run an oversight process if either:

1. 6 months have passed since the last oversight process.
2. More than 1/4 of Alliance members request an oversight process.
"
            />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default GovernancePage;

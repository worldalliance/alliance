import Card, { CardStyle } from "@alliance/shared/ui/Card";
import React from "react";
import Footer from "../../components/Footer";
import MarkdownWrapper from "../../components/MarkdownWrapper";
import MemberContract from "../../components/MemberContract";
import chevronRight from "../../assets/icons8-expand-arrow-96.png";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import { Link, href } from "react-router";

const GovernancePage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex flex-col md:flex-row mx-2 sm:mx-4 md:mx-12 pt-8 md:pt-32 pb-56 justify-center">
        <div className="flex flex-col max-w-[46rem]">
          <div className="mx-auto w-full mb-2">
            <h2 className="font-serif font-semibold !text-4xl text-black">
              Governance
            </h2>
          </div>

          <Link
            to={href("/progress/:slug", { slug: "early-governance" })}
            className="mb-6"
          >
            <Card
              style={CardStyle.White}
              className="mt-4 p-4 md:p-4 text-lg cursor-pointer hover:bg-zinc-50 flex flex-row gap-x-4 items-center justify-between"
            >
              <p className="text-base">
                The following governance procedures were developed and approved
                by 25 founding members of the Alliance.
              </p>
              <img src={chevronRight} className="w-4 h-4 rotate-270" />
            </Card>
          </Link>

          <div className="flex flex-col gap-y-6">
            <MarkdownWrapper
              id="foundation"
              className=""
              markdownContent="
## Membership
Members of the Alliance are individuals that have signed and abide by the following membership contract. 

"
            />

            <MemberContract id="contract" />

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
3. The assignment and delivery of these tasks to members. In a corollary to the terms of the current membership contract, the office assigns each 15-minute block of tasks a 7-day window that does not overlap with the 7-day window of any other block.

In designing actions, the office aims to satisfy both:
1. The collective interests of members, as can be reasonably determined through internal democratic processes.
2. The collective interests of humanity, as can be reasonably determined using available data about global preferences.

## Oversight
These procedures are in effect until they are modified by a governance review process that will require the participation of all members. The office will schedule this review process at its discretion.

The Alliance meets its approval threshold when more than 75% of members indicate that they expect more than 80% of their contributions to the Alliance will result in outcomes they approve of.

To ensure the Alliance meets its approval threshold, the office will run a periodic oversight process. During an oversight process, the office will:

1. Conduct a membership-wide survey to evaluate if the Alliance meets its approval threshold.
2. If it does not, then the office will repeat the following steps until the approval threshold is met:
   - Collect feedback from members about the direction of the Alliance and other major concerns.
   - Develop and communicate plans to address common feedback.
   - Re-evaluate whether the Alliance meets its approval threshold.

The office will run an oversight process if either of the following conditions have been met:

1. 3 months have passed and 10 tasks have been completed by Alliance members since the last oversight process.
2. More than 50% of Alliance members request an oversight process.
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

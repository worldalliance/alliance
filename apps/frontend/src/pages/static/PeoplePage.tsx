import {
  ProfileDto,
  type StaffDirectoryEntryDto,
  userMembersPublic,
  userNmembers,
  userStaffDirectory,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import React, { useEffect, useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import Footer from "../../components/Footer";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import PublicMemberDirectoryCard from "../../components/PublicMemberDirectoryCard";
import {
  LANDING_PAGE_STACK,
  LANDING_SECTION_PB,
  LANDING_SECTION_PY,
  LANDING_WIDE_SECTION,
  SUBTITLE_CLASS,
} from "./prelaunchLayout";

const SECTION_TITLE_CLASS = "text-title-large w-full text-black";

export async function loader() {
  const res = await userNmembers();
  return res.data?.count;
}

const PeoplePage: React.FC = () => {
  const nmembers = useLoaderData<typeof loader>();

  const [staffProfiles, setStaffProfiles] = useState<StaffDirectoryEntryDto[]>(
    [],
  );
  const [staffLoading, setStaffLoading] = useState(true);

  const [members, setMembers] = useState<ProfileDto[]>([]);

  const defaultDisplayCount = 100;
  const [displayCount, setDisplayCount] = useState(defaultDisplayCount);

  const experts = [
    {
      name: "Janos Pasztor",
      description: "Former UN Assistant Secretary-General for Climate Change",
    },
    {
      name: "Denis Hayes",
      description:
        "Founding coordinator of Earth Day, Chair and CEO of the Bullitt Foundation",
    },
    {
      name: "Tara Chklovski",
      description: "Founder, CEO, Technovation",
    },
    {
      name: "Brice Lalonde",
      description: "Former French Minister of the Environment",
    },
    {
      name: "Connie Guglielmo",
      description: "Former Editor-in-Chief, CNET",
    },
    {
      name: "Beth Barnes",
      description: "Founder and CEO of METR",
    },
    {
      name: "Durwood Zaelke",
      description:
        "President, Institute for Governance & Sustainable Development",
    },
    {
      name: "Dustin Palmer",
      description: "Executive Director, US Programs at GiveDirectly",
    },
    {
      name: "Tom Luben",
      description: "Former US EPA ORD Scientist",
    },
    {
      name: "Romina Picolotti",
      description:
        "President, Center for Human Rights and Environment; former Argentine Secretary of the Environment",
    },
    {
      name: "Gernot Wagner",
      description: "Climate economist, Columbia Business School",
    },
    {
      name: "Jennifer King",
      description: "Privacy & Data Policy Fellow, Stanford HAI",
    },
    {
      name: "Ben Kalina",
      description: "Filmmaker and professor",
    },
    {
      name: "Nathan Calvin",
      description: "General Counsel at Encode AI",
    },
    {
      name: "Kim Stanley Robinson",
      description: "Science fiction writer",
    },
    {
      name: "Oran Young",
      description: "Professor Emeritus, UC Santa Barbara",
    },
    {
      name: "Santiago Creuheras",
      description:
        "Harvard Ash Center Fellow; former Mexico Deputy Minister for the Environment and Sustainable Energy",
    },
    {
      name: "Travis Williams",
      description: "Professor of Chemistry, University of Southern California",
    },
    {
      name: "Matti Wilks",
      description: "Associate Professor in Psychology, University of Edinburgh",
    },
    {
      name: "Aditya Jain",
      description: "Instagram Trust and Safety",
    },
    {
      name: "Paul Gambill",
      description: "Climate entrepreneur; previously founder of Nori",
    },
  ];

  useEffect(() => {
    const fetchData = async () => {
      const [membersRes, staffRes] = await Promise.all([
        userMembersPublic(),
        userStaffDirectory(),
      ]);

      setMembers(membersRes.data ?? []);
      setStaffProfiles(staffRes.data ?? []);
      setStaffLoading(false);
    };

    void fetchData();
  }, []);

  const displayedMembers = useMemo(() => {
    return members.slice(0, displayCount);
  }, [members, displayCount]);

  const hasMoreMembers = members.length > displayCount;

  return (
    <div className="flex flex-col bg-white">
      <div className={LANDING_PAGE_STACK}>
        <PrelaunchNavbar transparent={false} absolute={false} />

        <section
          className={cn("w-full bg-white mt-8", LANDING_SECTION_PB)}
          id="office"
        >
          <div className={LANDING_WIDE_SECTION}>
            <div className="flex flex-col gap-4 text-center">
              <p className={SECTION_TITLE_CLASS}>Office</p>
              <p className={SUBTITLE_CLASS}>
                Our staff team plans actions, creates infrastructure, and
                manages the Alliance.
              </p>
            </div>
            {staffLoading ? (
              <p className="py-8 text-center text-zinc-500">Loading staff...</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-16 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
                {staffProfiles.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4"
                  >
                    <div className="hidden md:block">
                      <AvatarProfile
                        pfp={member.profilePicture ?? null}
                        size="override"
                        className="w-18 h-18 rounded"
                      />
                    </div>
                    <div className="block md:hidden">
                      <AvatarProfile
                        pfp={member.profilePicture ?? null}
                        size="override"
                        className="w-12 h-12 rounded"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-medium text-zinc-900 md:text-xl">
                        {member.displayName}
                      </p>
                      {member.staffTitle && (
                        <p className="text-base text-zinc-500">
                          {member.staffTitle}
                        </p>
                      )}
                      {member.staffLink && (
                        <a
                          href={member.staffLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-base text-link"
                        >
                          About
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section
          className={cn("w-full bg-green-bg", LANDING_SECTION_PY)}
          id="expert-group"
        >
          <div className={LANDING_WIDE_SECTION}>
            <div className="flex flex-col gap-4 text-center mb-6">
              <p className={`${SECTION_TITLE_CLASS} text-white`}>
                Expert group
              </p>
              <div className="flex flex-col gap-1">
                <p className={cn(SUBTITLE_CLASS, "text-white/90")}>
                  Experts occasionally lend time, knowledge, or resources to the
                  Alliance.
                </p>
                <p className={cn(SUBTITLE_CLASS, "text-white/60")}>
                  This list only includes experts who have chosen to make their
                  information public.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3">
              {experts.map((expert) => (
                <div key={expert.name}>
                  <p className="text-base font-medium text-white md:text-lg">
                    {expert.name}
                  </p>
                  <p className="text-base text-white/60 md:text-lg">
                    {expert.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className={cn("w-full bg-grey-0", LANDING_SECTION_PY)}
          id="members"
        >
          <div className={LANDING_WIDE_SECTION}>
            <div className="flex flex-col gap-4 text-center mb-6">
              <p className={SECTION_TITLE_CLASS}>Members</p>
              <div className="flex flex-col gap-1">
                {nmembers !== undefined && (
                  <p className={SUBTITLE_CLASS}>
                    The Alliance has {nmembers}{" "}
                    {nmembers === 1 ? "member" : "members"}. Membership is
                    currently by invitation only.
                  </p>
                )}
                <p className={`${SUBTITLE_CLASS} !text-zinc-500`}>
                  This directory only includes members who have chosen to make
                  their information public.
                </p>
              </div>
            </div>

            {members.length > 0 ? (
              <>
                <div className="gap-6 md:gap-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {displayedMembers.map((member) => (
                    <PublicMemberDirectoryCard
                      key={member.id}
                      member={member}
                    />
                  ))}
                </div>
                {hasMoreMembers && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() =>
                        setDisplayCount(displayCount + defaultDisplayCount)
                      }
                      className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Show more ({members.length - displayCount} remaining)
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="py-8 text-center text-zinc-500">
                Loading members...
              </p>
            )}
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default PeoplePage;

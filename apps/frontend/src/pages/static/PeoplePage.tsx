import {
  ProfileDto,
  userMembersPublic,
  userNmembers,
} from "@alliance/shared/client";
import React, { useEffect, useMemo, useState } from "react";
import Footer from "../../components/Footer";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import PublicMemberDirectoryCard from "../../components/PublicMemberDirectoryCard";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import { useLoaderData } from "react-router";

export async function loader() {
  const res = await userNmembers();
  return res.data;
}

const PeoplePage: React.FC = () => {
  const nmembers = useLoaderData<typeof loader>();
  const staffIds: Record<number, string> = useMemo(() => {
    return {
      10: "Mark Xu",
      7: "Sidney Hough",
      15: "Casey Manning",
      64: "Charles Lien",
      11: "Grant Hough",
      127: "Alex Hockett",
    };
  }, []);

  const [staffProfiles, setStaffProfiles] = useState<ProfileDto[]>([]);

  const [members, setMembers] = useState<ProfileDto[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const defaultDisplayCount = 100;
  const [displayCount, setDisplayCount] = useState(defaultDisplayCount);

  const experts = [
    {
      name: "Janos Pasztor",
      description: "Former UN Assistant Secretary-General for Climate Change",
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
      name: "Durwood Zaelke",
      description:
        "President, Institute for Governance & Sustainable Development",
    },
    {
      name: "Beth Barnes",
      description: "Founder and CEO of METR",
    },
  ];

  useEffect(() => {
    const fetchData = async () => {
      const membersRes = await userMembersPublic();

      setMembers(membersRes.data ?? []);

      // sort staff by names alphabetically
      setStaffProfiles(
        membersRes.data
          ?.filter((member) =>
            Object.keys(staffIds).includes(member.id.toString())
          )
          .sort((a, b) =>
            (a.displayName ?? "").localeCompare(
              b.displayName ?? "",
              undefined,
              { sensitivity: "base" }
            )
          )
          .reverse() ?? []
      );
    };

    fetchData();
  }, [staffIds]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) {
      return members;
    }
    const query = searchQuery.toLowerCase().trim();
    return members.filter((member) =>
      member.displayName?.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  // Reset display count when search query changes
  useEffect(() => {
    setDisplayCount(defaultDisplayCount);
  }, [searchQuery]);

  const displayedMembers = useMemo(() => {
    return filteredMembers.slice(0, displayCount);
  }, [filteredMembers, displayCount]);

  const hasMoreMembers = filteredMembers.length > displayCount;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex-1 max-w-4xl mx-auto pt-12 md:pt-28 pb-56 flex flex-col gap-y-16 md:gap-y-24 px-5 text-base md:text-lg">
        <h1 className="text-title-large text-center">People</h1>
        <div>
          <h2 className="text-title-small mb-4 text-center">Office</h2>
          <p className="mb-6 md:mb-12 text-zinc-900 text-center">
            Members of the office plan actions and develop our online platform.
          </p>
          <div className="space-y-8">
            {staffProfiles
              .filter((member) => member.id !== undefined)
              .map((member) => (
                <div key={member.id} className="flex gap-3 md:gap-4">
                  <div className="hidden md:block">
                    <AvatarProfile
                      pfp={member.profilePicture ?? null}
                      size="huge"
                    />
                  </div>
                  <div className="block md:hidden">
                    <AvatarProfile
                      pfp={member.profilePicture ?? null}
                      size="large"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg md:text-xl font-medium text-zinc-900">
                      {member.displayName}
                    </h3>
                    <div className="text-zinc-600 text-base md:mt-1">
                      <AppMarkdownWrapper
                        markdownContent={member.profileDescription ?? ""}
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
        <div>
          <h2 className="text-title-small mb-4 text-center">Experts</h2>
          <p className="text-zinc-900 text-center">
            We are gradually building a group of experts who occasionally lend
            time, knowledge, or resources to the Alliance.
          </p>
          <p className="text-zinc-500 text-base mb-4 text-center">
            This list only includes experts who have chosen to make their
            information public.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8 mt-12">
            {experts.map((expert) => (
              <div key={expert.name} className="">
                <p className="text-zinc-900 text-base">{expert.name}</p>
                <p className="text-zinc-500 text-base">{expert.description}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-title-small mb-4 text-center">Members</h2>
          {nmembers !== undefined && (
            <p className="text-zinc-900 text-center">
              The Alliance has {nmembers} members. Membership is currently by
              invitation only.
            </p>
          )}
          <p className="text-zinc-500 text-base mb-4 text-center">
            This directory only includes members who have chosen to make their
            information public.
          </p>
          <div className="mt-6 md:mt-12 mb-4">
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border bg-white border-zinc-200 py-2 px-3 rounded text-base"
            />
          </div>
          {filteredMembers.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {displayedMembers.map((member) => (
                  <PublicMemberDirectoryCard key={member.id} member={member} />
                ))}
              </div>
              {hasMoreMembers && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() =>
                      setDisplayCount(displayCount + defaultDisplayCount)
                    }
                    className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50"
                  >
                    Show more ({filteredMembers.length - displayCount}{" "}
                    remaining)
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-zinc-500 text-center py-8">
              {searchQuery.trim()
                ? "No members found matching your search."
                : "Loading members..."}
            </p>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PeoplePage;

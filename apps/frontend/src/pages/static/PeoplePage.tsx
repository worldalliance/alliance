import {
  ProfileDto,
  userMembersPublic,
} from "@alliance/shared/client";
import React, { useEffect, useMemo, useState } from "react";
import Footer from "../../components/Footer";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import sidneyandmark from "../../assets/sidneyandmark.jpg";
import PublicMemberDirectoryCard from "../../components/PublicMemberDirectoryCard";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";

const PeoplePage: React.FC = () => {
  const staffIds: Record<number, string> = useMemo(() => {
    return {
      10: "Mark Xu",
      7: "Sidney Hough",
      15: "Casey Manning",
      64: "Charles Lien",
    };
  }, []);

  const [staffProfiles, setStaffProfiles] = useState<ProfileDto[]>([]);

  const [members, setMembers] = useState<ProfileDto[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const defaultDisplayCount = 100;
  const [displayCount, setDisplayCount] = useState(defaultDisplayCount);

  useEffect(() => {
    const fetchData = async () => {
      const membersRes = await userMembersPublic();

      setMembers(membersRes.data ?? []);

      // sort staff by names alphabetically
      setStaffProfiles(membersRes.data?.filter((member) => Object.keys(staffIds).includes(member.id.toString())).sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, { sensitivity: "base" })).reverse() ?? []);
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
      <div className="flex-1 max-w-4xl mx-auto pt-16 md:pt-28 pb-56 flex flex-col px-5 text-base md:text-lg">
        <h2 className="font-semibold text-3xl md:text-5xl font-serif mb-8 md:mb-12">
          People
        </h2>
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <p className="text-zinc-900">
            The Alliance was founded by Sidney Hough and Mark Xu, a couple
            living in San Francisco, California, U.S.A.
          </p>
          <img
            src={sidneyandmark}
            alt="Sidney and Mark"
            className="max-w-96 h-auto rounded-md"
          />
        </div>
        <div className="mt-12 md:mt-20">
          <h2 className="!font-semibold !text-xl md:!text-3xl my-4 font-serif">
            Strategic office
          </h2>
          <p className="mb-6 text-zinc-900">
            Members of the office plan actions and develop our online
            platform.
          </p>
          <div className="space-y-8">
            {staffProfiles
              .filter((member) => member.id !== undefined)
              .map((member) => (
                <div key={member.id} className="flex gap-5">
                  <ProfileImage pfp={member.profilePicture ?? null} size="huge" />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-zinc-900">{member.displayName}</h3>
                    <div className="text-zinc-600 text-base mt-1">
                      <AppMarkdownWrapper
                        markdownContent={member.profileDescription ?? ""}
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
        <div className="mt-12 md:mt-16">
          <h2 className="!font-semibold !text-xl md:!text-3xl my-4 font-serif">
            Members
          </h2>
          <p className="text-zinc-900">
            The Alliance has 74 members. Membership is currently by invitation
            only.
          </p>
          <p className="text-zinc-500 text-base mb-4">
            This directory only includes members who have chosen to make their
            information public.
          </p>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border bg-white border-zinc-200 py-2 px-3 rounded text-base"
            />
          </div>
        </div>
        {filteredMembers.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {displayedMembers.map((member) => (
                <PublicMemberDirectoryCard
                  key={member.id}
                  member={member}
                />
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
      <Footer />
    </div>
  );
};

export default PeoplePage;

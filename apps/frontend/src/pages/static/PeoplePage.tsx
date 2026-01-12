import {
  ProfileDto,
  userFindOne,
  userMembersPublic,
} from "@alliance/shared/client";
import React, { useEffect, useMemo, useState } from "react";
import Footer from "../../components/Footer";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import sidneyandmark from "../../assets/sidneyandmark.jpg";
import PublicMemberDirectoryCard from "../../components/PublicMemberDirectoryCard";

const PeoplePage: React.FC = () => {
  const staffIds: Record<string, number> = useMemo(() => {
    return {
      "Mark Xu": 10,
      "Sidney Hough": 7,
      "Casey Manning": 15,
      "Eamon OCearuil": 24,
      "Charles Lien": 64,
    };
  }, []);

  const [staffProfiles, setStaffProfiles] = useState<ProfileDto[]>([]);

  const [members, setMembers] = useState<ProfileDto[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const defaultDisplayCount = 100;
  const [displayCount, setDisplayCount] = useState(defaultDisplayCount);

  useEffect(() => {
    const fetchData = async () => {
      const staffProfilesResponse = await Promise.all(
        Object.values(staffIds).map(async (id) => {
          const result = await userFindOne({ path: { id } });
          const { data: profile } = result;

          return profile;
        })
      );

      setStaffProfiles(
        staffProfilesResponse.filter(
          (profile): profile is ProfileDto => profile !== undefined
        ) ?? []
      );

      const membersRes = await userMembersPublic();

      setMembers(membersRes.data ?? []);
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
      <div className="flex-1 container mx-auto pt-16 md:pt-28 pb-56 flex flex-col px-5">
        <div className="mx-auto w-full flex flex-col text-base md:text-lg gap-y-8 md:gap-y-12">
          <h2 className="font-semibold text-3xl md:text-5xl font-serif">
            People
          </h2>
          <div>
            <h2 className="!font-semibold !text-xl md:!text-2xl mb-4">
              Strategic office
            </h2>

            <div className="w-full flex flex-col gap-4">
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

            <p className="my-4 text-zinc-900">
              Members of the office plan actions and develop our online
              platform.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {staffProfiles
                .filter((member) => member.id !== undefined)
                .map((member) => (
                  <PublicMemberDirectoryCard
                    key={member.id}
                    member={member}
                    showDescription={true}
                  />
                ))}
            </div>
          </div>
          <div>
            <h2 className="!font-semibold !text-xl md:!text-2xl mb-4">
              Members
            </h2>
            <p className="text-zinc-900">
              The Alliance has 67 members. Membership is currently by invitation
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

            {filteredMembers.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3  gap-2">
                  {displayedMembers.map((member) => (
                    <PublicMemberDirectoryCard
                      key={member.id}
                      member={member}
                    />
                  ))}
                </div>
                {hasMoreMembers && (
                  <div className="mt-4 flex justify-center">
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
      </div>
      <Footer />
    </div>
  );
};

export default PeoplePage;

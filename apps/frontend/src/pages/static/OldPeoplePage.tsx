import { ProfileDto, userFindOne } from "@alliance/shared/client";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import React, { useEffect, useMemo, useState } from "react";
import Footer from "../../components/Footer";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import sidneyandmark from "../../assets/sidneyandmark.jpg";

const PeoplePage: React.FC = () => {
  const authorIds: Record<string, number> = useMemo(() => {
    return {
      "Mark Xu": 10,
      "Sidney Hough": 7,
      "Casey Manning": 15,
      "Eamon OCearuil": 24,
      "Charles Lien": 64,
    };
  }, []);

  const authorLinks: Record<string, string> = useMemo(() => {
    return {
      "Mark Xu": "https://markxu.com/",
      "Sidney Hough": "https://sidney.com/",
      "Casey Manning": "https://caseymanning.github.io/",
      "Eamon OCearuil": "https://worldalliance.org/member/24",
      "Charles Lien": "https://worldalliance.org/member/64",
    };
  }, []);

  const [authorProfiles, setAuthorProfiles] = useState<
    Record<string, ProfileDto | null>
  >({});

  useEffect(() => {
    const fetchData = async () => {
      const responses = await Promise.all(
        Object.entries(authorIds).map(async ([name, id]) => {
          const result = await userFindOne({ path: { id } });
          const { data: profile } = result;
          return [name, profile];
        })
      );

      const authorProfiles = Object.fromEntries(
        responses.map(([name, profile]) => [name, profile])
      );

      setAuthorProfiles(authorProfiles);
    };

    fetchData();
  }, [authorIds]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex-1 container mx-auto pt-16 md:pt-28 pb-56 flex flex-col px-5">
        <div className="mx-auto w-full max-w-3xl flex flex-col text-base md:text-lg gap-y-8 md:gap-y-12">
          <h2 className="font-semibold text-3xl md:text-5xl">People</h2>
          <div>
            <h2 className="!font-semibold !text-xl md:!text-2xl mb-4">
              Members
            </h2>
            <p className="text-zinc-900">
              The Alliance has 73 members. Membership is currently by invitation
              only.
            </p>
          </div>
          <div>
            <h2 className="!font-semibold !text-xl md:!text-2xl mb-4">
              Strategic office
            </h2>

            <div className="w-full flex flex-col gap-4 mb-8">
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

            <p className="mb-4 text-zinc-900">
              Members of the office plan actions and develop our online
              platform.
            </p>

            <div className="">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-12 gap-y-2 text-base md:text-lg">
                {Object.entries(authorLinks).map(([name, link]) => (
                  <p
                    key={name}
                    className="rounded-lg flex items-center gap-x-2"
                  >
                    <ProfileImage
                      pfp={authorProfiles[name]?.profilePicture ?? null}
                      size="small"
                    />
                    <a className="text-link" href={link}>
                      {name}
                    </a>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PeoplePage;

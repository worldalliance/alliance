import { ProfileDto, userFindOne } from "@alliance/shared/client";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import React, { useEffect, useMemo, useState } from "react";
import Footer from "../../components/Footer";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";

const PeoplePage: React.FC = () => {
  const authorIds: Record<string, number> = useMemo(() => {
    return {
      "Mark Xu": 10,
      "Sidney Hough": 7,
      "Casey Manning": 15,
      "Eamon OCearuil": 24,
    };
  }, []);

  const authorLinks: Record<string, string> = useMemo(() => {
    return {
      "Mark Xu": "https://markxu.com/",
      "Sidney Hough": "https://sidney.com/",
      "Casey Manning": "https://caseymanning.github.io/",
      "Eamon OCearuil": "https://worldalliance.org/user/24",
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
        <div className="mx-auto w-full max-w-3xl flex flex-col gap-4 md:gap-12">
          <h2 className="text-center font-serif !font-medium !text-4xl md:!text-6xl">
            People
          </h2>

          <div className="flex flex-col text-base md:text-lg">
            <p>
              The Alliance has a body of members committed to taking actions and
              a full-time strategic office that plans actions.
            </p>

            <h2 className="!font-medium !text-xl md:!text-2xl !mt-8 mb-3">
              Members
            </h2>
            <p>40 members are participating in early experiments.</p>

            <h2 className="!font-medium !text-xl md:!text-2xl !mt-8 mb-3">
              Strategic Office
            </h2>

            <div className="flex flex-col gap-y-1 text-base md:text-lg">
              {Object.entries(authorLinks).map(([name, link]) => (
                <p key={name} className="flex items-center gap-x-2">
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
      <Footer />
    </div>
  );
};

export default PeoplePage;

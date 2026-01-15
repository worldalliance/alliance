import React from "react";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import "./PrelaunchLanding.css";
import Footer from "../../components/Footer";
import alliancePeople from "../../assets/alliance_people.jpg";

const PrelaunchLandingPage: React.FC = () => {
  return (
    <>
      <div className="min-h-screen flex flex-col bg-white">
        <PrelaunchNavbar transparent={false} absolute={false} />
        <div className="flex-1 container mx-auto flex flex-col px-5 py-5">
          <div className="flex flex-col md:flex-row gap-y-12 md:gap-x-18 items-center mx-auto my-auto py-12">
            {/* <img src={earth} className="mx-auto mb-12 w-50" /> */}

            <div className="max-w-2xl w-full flex flex-col gap-y-6 text-lg md:text-xl text-zinc-900">
              <p className="font-medium font-serif text-4xl sm:text-5xl lg:text-6xl text-black">
                Individuals cooperating to improve the world
              </p>

              <p>
                Members of the Alliance complete regular tasks that address our
                shared priorities: extreme poverty, environmental destruction,
                the breakdown of democratic institutions, and dangerous
                technological development.
              </p>

              <p>
                We aim to give our members, and ultimately a significant
                proportion of humanity, the ability to make deliberate,
                large-scale change.
              </p>

              <p>
                We are in an experimental phase: membership is by invitation
                only.
              </p>
            </div>
            <div className="w-full md:max-w-[45%] flex flex-col gap-y-4 items-center justify-center">
              <img
                src={alliancePeople}
                alt="Alliance members"
                className="rounded-md"
              />
              <p className="text-center text-zinc-500">
                A few members gathered in San Francisco, California
              </p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
};

export default PrelaunchLandingPage;

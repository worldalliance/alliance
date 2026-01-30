import React from "react";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import "./PrelaunchLanding.css";
import Footer from "../../components/Footer";
import alliancePeople from "../../assets/alliance_people.jpg";

const PrelaunchLandingPage: React.FC = () => {
  return (
    <>
      <div className="min-h-screen flex flex-col bg-white">
        <PrelaunchNavbar
          transparent={false}
          absolute={false}
          showLogo={false}
        />
        <div className="flex-1 container mx-auto flex flex-col px-5 py-5">
          <div className="flex flex-col gap-y-8 md:gap-y-12 mx-auto my-auto py-8 md:py-12">
            {/* <img src={earth} className="mx-auto mb-12 w-50" /> */}

            <div className="max-w-2xl w-full flex flex-col gap-y-6 md:gap-y-8">
              <p className="font-berlingske uppercase font-medium font-serif text-3xl sm:text-4xl lg:text-5xl text-black">
                The Alliance
              </p>
              <div className="flex flex-col gap-y-6 text-zinc-900 text-lg md:text-xl">
                <p>
                  The Alliance is a global group of people cooperating to
                  improve the world. Our priorities are extreme poverty,
                  environmental destruction, the breakdown of democratic
                  institutions, and dangerous technological development.
                </p>

                <p>
                  We aim to give our members, and ultimately a significant
                  proportion of humanity, the ability to make deliberate,
                  large-scale change.
                </p>

                <p>
                  We are in an experimental phase. Membership is by invitation
                  only.
                </p>
              </div>
            </div>
            <div className="w-full flex flex-col gap-y-4 items-center justify-center">
              <img
                src={alliancePeople}
                alt="Alliance members"
                className="rounded-md w-full max-w-[1000px]"
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

import React from "react";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import "./PrelaunchLanding.css";
import Footer from "../../components/Footer";

const PrelaunchLandingPage: React.FC = () => {
  return (
    <>
      <div className="min-h-screen flex flex-col bg-white">
        <PrelaunchNavbar transparent={false} absolute={false} />
        <div className="flex-1 container mx-auto flex flex-col px-5 py-5">
          <div className="flex flex-col mx-auto my-auto max-w-2xl py-12 sm:py-24 lg:py-36 lg:pb-16">
            {/* <img src={earth} className="mx-auto mb-12 w-50" /> */}

            <div className="mx-auto w-full flex flex-col gap-y-6 text-lg md:text-xl">
              <p className="font-semibold ">
                The Alliance is a group of individuals coordinating to combat
                global crises.
              </p>

              <p>
                Each week, every member of the Alliance spends a small amount of
                time completing tasks on our online platform. These tasks add up
                to collective actions that address extreme poverty,
                environmental destruction, the breakdown of democratic
                institutions, and dangerous technological development.
              </p>

              <p>
                Members commit a regular amount of their time to the Alliance,
                which allows our full-time office to develop concrete and
                effective action plans.
              </p>

              <p>
                Eventually, we aim to give our members, and ultimately a
                significant proportion of humanity, the ability to make
                deliberate, large-scale change.
              </p>

              <p>
                We are in an experimental phase. Membership is by invitation
                only.
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

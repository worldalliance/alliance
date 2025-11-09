import React from "react";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import "./PrelaunchLanding.css";
import Footer from "../../components/Footer";
import MarkdownWrapper from "../../components/MarkdownWrapper";

const PrelaunchLandingPage: React.FC = () => {
  return (
    <>
      <div className="min-h-screen flex flex-col bg-white">
        <PrelaunchNavbar transparent={false} absolute={false} />
        <div className="flex-1 container mx-auto flex flex-col px-5 py-5">
          <div className="flex flex-col mx-auto my-auto px-6 sm:px-24 lg:px-60 py-12 sm:py-24 lg:py-36">
            {/* <img src={earth} className="mx-auto mb-12 w-50" /> */}
            <div className="mx-auto">
              <p className=" max-w-4xl font-medium text-3xl sm:text-6xl font-serif ">
                We are individuals coordinating to combat global crises.
              </p>
            </div>

            <div className="mx-auto w-full flex flex-col mt-6 sm:mt-14">
              <MarkdownWrapper
                id="introduction"
                maxWidth="max-w-4xl"
                markdownContent="

Humanity faces crises that are causing irreversible and compounding harms. Among them are extreme poverty, environmental destruction, breakdown of democratic institutions, and dangerous technological development.

The Alliance aims to give its members, and ultimately a significant proportion of humanity, the ability to make deliberate, large-scale change. We plan to do so by facilitating strategic, sustained collective action.

The bedrock of the Alliance is commitment. Members are expected to contribute a small, consistent amount of their time and resources.

We are in an experimental phase. Membership is by invitation only.

"
              />
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default PrelaunchLandingPage;

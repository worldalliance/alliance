import React from "react";
import Footer from "../../components/Footer";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import MarkdownWrapper from "../../components/MarkdownWrapper";

const PeoplePage: React.FC = () => {
  return (
    <div>
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="container mx-auto pt-24 pb-42 flex flex-col px-5 max-w-4xl">
        <div className="flex flex-col gap-5">
          <h1 className="text-black font-avenir !text-4xl">People</h1>

          <MarkdownWrapper
            markdownContent="

Coming soon

"
          />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PeoplePage;

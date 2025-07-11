import React from "react";
import Footer from "../../components/Footer";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import MarkdownWrapper from "../../components/MarkdownWrapper";

const PeoplePage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex-1 container mx-auto pt-20 md:pt-28 pb-56 flex flex-col px-5">
        <div className="mx-auto w-full max-w-3xl flex flex-col gap-6">
          <h2 className="font-sabon !font-semibold !text-4xl md:!text-5xl text-center">
            People
          </h2>

          <MarkdownWrapper
            markdownContent="

The Strategic Office is currently composed of:
- [Mark Xu](https://markxu.com/)
- [Sidney Hough](https://sidney.com/)
- [Casey Manning](https://caseymanning.github.io/)

"
          />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PeoplePage;

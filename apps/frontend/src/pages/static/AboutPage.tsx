import React from "react";
import NewNavbar from "../../components/NewNavbar";
import Footer from "../../components/Footer";
import LineHeader from "../../components/LineHeader";

const AboutPage: React.FC = () => {
  return (
    <div>
      <NewNavbar transparent={false} />
      <div className="bg-white w-1/2 container mx-auto pt-30 pb-42 flex flex-col gap-y-10 px-5 text-[12pt]">
        <div className="bg-hgreen text-white p-10 min-w-100vw gap-y-5 flex flex-col rounded-md">
          <h1>What is the Alliance?</h1>
          <div className="flex flex-col gap-y-5">
            <p>
              lorem ipsum dolor sit amet, adipiscing elit. Sed do eiusmod tempor
              incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit
              amet, consectetur elit. Sed do eiusmod tempor incididunt ut labore
              et dolore magna aliqua. lorem dolor sit amet, consectetur
              adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua. Lorem ipsum dolor sit amet, conse sit amet
              tempor.
            </p>
            <p>
              lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem
              ipsum dolor sit amet, conse sit amet tempor.
            </p>
          </div>
        </div>
        <LineHeader title="Our priorities" />
        <div className="flex flex-col gap-y-5">
          <h2 className="text-black font-sabon">1. Climate</h2>
          <p>
            lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem
            ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
            tempor incididunt ut labore et dolore magna aliqua. lorem ipsum
            dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit
            amet, conse sit amet tempor.
          </p>
          <p>
            lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
          <h2 className="text-black font-sabon">
            2. Technological Catastrophe
          </h2>
          <p>
            lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem
            ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
            tempor incididunt ut labore et dolore magna aliqua. lorem ipsum
            dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit
            amet, conse sit amet tempor.
          </p>
          <p>
            lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem
            ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
            tempor incididunt ut labore et dolore magna aliqua. lorem ipsum
            dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua.
          </p>
          <h2 className="text-black font-sabon">3. Extreme Poverty</h2>
          <p>
            lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem
            ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
            tempor incididunt ut labore et dolore magna aliqua. lorem ipsum
            dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit
            amet, conse sit amet tempor.
          </p>
        </div>
        <LineHeader title="Organization" />
        <p>
          lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem
          ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
          tempor incididunt ut labore et dolore magna aliqua. lorem ipsum dolor
          sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
          incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit
          amet, conse sit amet tempor.
        </p>
      </div>
      <Footer />
    </div>
  );
};

export default AboutPage;

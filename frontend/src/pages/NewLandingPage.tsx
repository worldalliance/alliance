import React from "react";
import HighResGlobe from "../components/HighResGlobe";

const NewLandingPage: React.FC = () => {
  const size = 1.7 * window.innerHeight;
  return (
    <div className="flex flex-col items-center justify-center bg-gray-950 w-screen h-screen overflow-hidden relative goob">
      <div className="ml-[-50%]">
        <HighResGlobe width={size} height={size} />
      </div>
      <div className="absolute bottom-0 left-0 right-0 top-0 m-auto flex justify-center items-center">
        <p className="text-white font-bold font-berlingske !text-[60pt]">
          landing page
        </p>
      </div>
    </div>
  );
};

export default NewLandingPage;

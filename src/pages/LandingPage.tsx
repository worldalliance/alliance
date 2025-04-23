import React from "react";
import { Link } from "react-router-dom";
import HighResGlobe from "../components/HighResGlobe";
import Card from "../components/system/Card";

const LandingPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center bg-gray-950 text-white">
      <div className="flex flex-col items-center justify-center text-center pt-[50px]">
        <div className="flex flex-row flex-nowrap items-center justify-center h-[500px]">
          <div className="w-[500px] ">
            <HighResGlobe />
          </div>
        </div>
        <div className="flex flex-col items-center text-left w-[100%] mt-[50px] gap-y-10 p-10 max-w-[1000px]">
          <h1 className="text-4xl text-[32pt]">Our Priorities</h1>
          <div className="flex flex-row flex-nowrap items-center justify-center gap-x-10 w-full text-center">
            <div className="bg-white/10 h-[400px] flex-1 p-3 rounded">
              <h1>Lorem</h1>
            </div>
            <div className="bg-white/10 h-[400px] flex-1 p-3 rounded">
              <h1>Ipsum</h1>
            </div>
            <div className="bg-white/10 h-[400px] flex-1 p-3 rounded">
              <h1>Dolor</h1>
            </div>
          </div>
        </div>

        <div className="flex flex-row flex-nowrap items-center justify-center w-[400px]"></div>
      </div>
    </div>
  );
};

export default LandingPage;

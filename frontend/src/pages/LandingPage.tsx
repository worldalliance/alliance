import React from "react";
import { Link } from "react-router-dom";
import HighResGlobe from "../components/HighResGlobe";
import Card from "../components/system/Card";
import Globe from "../components/Globe";
import downArrow from "../assets/icons8-expand-arrow-96.png";
import LandingNavbar from "../components/LandingNavbar";
import Button, { ButtonColor } from "../components/system/Button";

const LandingPage: React.FC = () => {
  return (
    <>
      <LandingNavbar />
      <div className="flex flex-col items-center justify-center bg-white  h-screen">
        <div className="flex flex-col items-center justify-center text-center mt-[-80px]">
          <div className="flex flex-row flex-nowrap items-center justify-center h-[500px]">
            <div className="w-[500px] relative">
              <Globe strokeWidth={0.7} />
              <p
                className="absolute bottom-0 top-0 left-0 m-auto right-0 z-10 py-8 text-xl w-fit h-fit "
                style={{
                  textShadow:
                    "-1px 0 white, 0 1px white, 1px 0 white, 0 -1px white",
                }}
              >
                24,215 members
              </p>
            </div>
          </div>
        </div>
        <div className="absolute bottom-10 left-0 right-0 flex flex-row justify-center items-center">
          <img src={downArrow} alt="down arrow" className="w-[20px] h-[20px]" />
        </div>
      </div>
      <div className="flex flex-col items-center bg-white text-black h-screen p-10">
        <div className="flex flex-col text-center">
          <h1 className="text-4xl">Our Priorities</h1>
        </div>
      </div>
    </>
  );
};

export default LandingPage;

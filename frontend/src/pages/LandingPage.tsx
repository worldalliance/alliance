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
      <div className="flex flex-col items-center justify-center bg-white text-white h-screen">
        <div className="flex flex-col items-center justify-center text-center pt-[50px]">
          <div className="flex flex-row flex-nowrap items-center justify-center h-[500px]">
            <div className="w-[500px] ">
              <Globe strokeWidth={0.7} />
              <p
                className="absolute bottom-0 top-0 left-0 m-auto right-0 z-10 text-black/90 py-8 text-xl w-fit h-fit pt-20"
                style={{
                  filter: "drop-shadow(0 0 10px rgb(255, 255, 255))",
                }}
              >
                24,215 members
              </p>
            </div>
          </div>
          <div className="flex gap-6 mt-8">
            <Link to="/login">
              <Button 
                label="Login" 
                onClick={() => {}} 
                color={ButtonColor.Blue}
              />
            </Link>
            <Link to="/signup">
              <Button 
                label="Create Account" 
                onClick={() => {}} 
                color={ButtonColor.Green}
              />
            </Link>
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

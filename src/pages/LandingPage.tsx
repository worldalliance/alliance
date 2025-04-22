import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Globe from "../components/Globe";
import Logo from "../components/Logo";

const LandingPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="flex flex-row flex-nowrap items-center justify-center">
          {/* <Logo /> */}
          <h1 className="text-4xl ml-3 font-berlingske text-[48pt]">
            The Alliance
          </h1>
        </div>
        <p className="max-w-[500px] text-[12pt] m-5">
          An online democratic polity to solve the world's most pressing issues
          in climate, AI, inequality, and other such things like that.
        </p>
        <div className="flex flex-row flex-nowrap items-center justify-center w-[400px]">
          <Globe />
        </div>
        <Link
          to="/home"
          className="text-black font-extrabold font-itc pt-[50px]"
        >
          Join Today.
        </Link>
      </div>
    </div>
  );
};

export default LandingPage;

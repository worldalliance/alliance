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
          <Logo />
          <h1 className="text-4xl">The Alliance</h1>
        </div>
        <p className="max-w-[500px] text-[12pt] mb-5">
          An online democratic polity to solve the world's most pressing issues
          in climate, AI, inequality, and other such things like that.
        </p>
        <div className="flex flex-row flex-nowrap items-center justify-center">
          <div className="w-[20vw] text-right">
            <p className="my-[30px]">
              <strong>12,643</strong> members
            </p>
            <p className="my-[30px]">
              <strong>$99,999,999</strong> donated to land conservation
            </p>
            <p className="my-[30px]">
              <strong>6</strong> landlords disembowled{" "}
            </p>
          </div>
          <Globe />
          <div className="w-[20vw] text-left">
            <p className="my-[30px]">
              Feeding <strong>3</strong> baby calves daily
            </p>
            <p className="my-[30px]">
              Saved <strong>2000</strong> shrimp souls
            </p>
            <p className="my-[30px]">
              Lorem'd <strong>3</strong> ipsums
            </p>
          </div>
        </div>
        <Link to="/home" className="text-black font-extrabold font-itc-bold pt-[50px]">
          Join Today.
        </Link>
      </div>
    </div>
  );
};

export default LandingPage;

import React from "react";
import { Link } from "react-router";

interface FooterProps {
  className?: string;
}

const Footer: React.FC<FooterProps> = ({ className }) => {
  return (
    <footer className={`w-full bg-stone-100 py-12 px-8 ${className}`}>
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 hidden md:mb-0 md:block">
            <p className="text-2xl font-berlingske uppercase">The Alliance</p>
          </div>
          <div className="flex flex-row gap-6 md:gap-10 text-base">
            <Link
              to="/people"
              className="font-serif text-lg text-gray-600 hover:text-black"
            >
              People
            </Link>
            <Link
              to="/guide"
              className="font-serif text-lg text-gray-600 hover:text-black"
            >
              Guide
            </Link>

            {/* <div className="flex flex-col gap-2">
              <p className="font-bold text-gray-800">Platform</p>
              <Link to="/issues" className="text-gray-600 hover:text-black">
                Issues
              </Link>
              <Link to="/forum" className="text-gray-600 hover:text-black">
                Forum
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-bold text-gray-800">About</p>
              <Link to="/" className="text-gray-600 hover:text-black">
                Mission
              </Link>
              <Link to="/" className="text-gray-600 hover:text-black">
                Team
              </Link>
            </div> */}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

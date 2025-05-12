import React from "react";
import { Link } from "react-router-dom";

interface FooterProps {
  className?: string;
}

const Footer: React.FC<FooterProps> = ({ className }) => {
  return (
    <footer
      className={`w-full border-t border-[#ddd] bg-gray-100 py-6 px-8 ${className}`}
    >
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 hidden md:mb-0 md:block">
            <p className="text-[14pt] font-berlingske py-10">alliance</p>
          </div>
          <div className="flex flex-row gap-6 md:gap-10">
            <div className="flex flex-col gap-2">
              <p className="font-bold text-sm text-gray-800">Platform</p>
              <Link
                to="/issues"
                className="text-gray-600 hover:text-black text-sm"
              >
                Issues
              </Link>
              <Link
                to="/forum"
                className="text-gray-600 hover:text-black text-sm"
              >
                Forum
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-bold text-sm text-gray-800">About</p>
              <Link to="/" className="text-gray-600 hover:text-black text-sm">
                Mission
              </Link>
              <Link to="/" className="text-gray-600 hover:text-black text-sm">
                Team
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

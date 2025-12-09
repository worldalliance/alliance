import React from "react";
import { Link, href } from "react-router";

interface FooterProps {
  className?: string;
}

const Footer: React.FC<FooterProps> = ({ className }) => {
  return (
    <footer className={`w-full text-zinc-500  py-5 md:py-12 px-5 ${className}`}>
      <div className="container mx-auto flex flex-col">
        <div className="flex flex-col items-center justify-center">
          <div className="flex flex-row flex-wrap gap-4 md:gap-6 text-sm sm:text-base">
            <Link to={href("/people")} className="hover:underline">
              People
            </Link>
            <Link to={href("/guide")} className="hover:underline">
              Guide
            </Link>
            <Link to={href("/progress")} className="hover:underline">
              Progress
            </Link>
            <Link to={href("/privacypolicy")} className="hover:underline">
              Privacy
            </Link>
            <Link to={href("/terms")} className="hover:underline">
              Terms
            </Link>
            <a href="mailto:contact@worldalliance.org" className="">
              Contact
            </a>
          </div>
          <p className="text-sm md:text-base mt-4">
            &copy; {new Date().getFullYear()} Alliance Foundation
          </p>
        </div>

        {/* <div className="flex flex-row items-start justify-between">
          <div className="mb-4 md:mb-0 h-full flex-1 flex flex-col items-between">
            <p className="text-lg sm:text-xl font-berlingske uppercase">
              The Alliance
            </p>
            <p className="text-sm md:text-base mt-4 sm:mt-32">
              &copy; {new Date().getFullYear()} Alliance Foundation
            </p>
          </div>
          <div className="flex flex-row gap-4 md:gap-10 text-sm sm:text-base">
            <div className="flex flex-col gap-y-2 *:hover:underline">
              <Link to={href("/people")} className="">
                People
              </Link>
              <Link to={href("/guide")} className="">
                Guide
              </Link>
              <Link to={href("/progress")} className="">
                Progress
              </Link>
            </div>
            <div className="flex flex-col gap-y-2 *:hover:underline">
              <Link to={href("/privacypolicy")} className="">
                Privacy
              </Link>
              <Link to={href("/terms")} className="">
                Terms
              </Link>
              <a href="mailto:contact@worldalliance.org" className="">
                Contact
              </a>
            </div>
          </div>
        </div> */}
      </div>
    </footer>
  );
};

export default Footer;

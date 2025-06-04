import { Link } from "react-router";

const LandingNavbar = () => {
  return (
    <div
      className="
      flex flex-row border-b border-[#ddd] z-10
    w-screen text-left space-x-10 items-center justify-evenly pl-6 sticky py-3 bg-white"
    >
      <Link to="/">
        <p className="pt-1 whitespace-nowrap !text-[12pt] ">News</p>
      </Link>
      <Link to="/issues">
        <p className="pt-1 whitespace-nowrap !text-[12pt]">Issues</p>
      </Link>
      <Link to="/">
        <p className="pt-1 whitespace-nowrap !text-[14pt] font-berlingske">
          The ALLIANCE
        </p>
      </Link>
      <Link to="/">
        <p className="pt-1 whitespace-nowrap !text-[12pt]">Platform</p>
      </Link>
      <Link to="/login">
        <p className="pt-1 whitespace-nowrap !text-[12pt]">Login</p>
      </Link>
    </div>
  );
};

export default LandingNavbar;

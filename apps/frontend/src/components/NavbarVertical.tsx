import { Link } from "react-router";
import { destinations, links, NavbarProps } from "./Navbar";

export type InnerNavbarProps = Pick<NavbarProps, "currentPage">;

const NavbarVertical: React.FC<InnerNavbarProps> = ({ currentPage }) => {
  return (
    <div className="flex flex-col w-[180px] bg-white border-r border-r-[#ddd] shadow-sm pl-6 h-screen text-left space-y-4 justify-center sticky">
      {links.map((link) => (
        <Link to={destinations[link]} key={link}>
          <p
            className={` p-2 m-0 ${currentPage === link ? "bg-gray-100" : ""}`}
          >
            {link}
          </p>
        </Link>
      ))}
    </div>
  );
};

export default NavbarVertical;

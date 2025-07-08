import { Link, useNavigate } from "react-router";

enum NavbarPage {
  People = "People",
  Guide = "Guide",
}

export const links: NavbarPage[] = [NavbarPage.People, NavbarPage.Guide];

export const destinations: Record<NavbarPage, string> = {
  [NavbarPage.People]: "/people",
  [NavbarPage.Guide]: "/guide",
};

export interface PrelaunchNavbarProps {
  transparent?: boolean;
  absolute?: boolean;
  ref?: React.RefObject<HTMLDivElement | null>;
}

const PrelaunchNavbar: React.FC<PrelaunchNavbarProps> = ({
  transparent = true,
  absolute = true,
  ref,
}: PrelaunchNavbarProps) => {
  const navigate = useNavigate();
  return (
    <div
      className={`
      flex flex-col sm:flex-row gap-y-4 ${absolute ? "absolute" : "relative"}
      w-screen justify-between items-center px-24 top-0 left-0 z-10 text-[14pt] transition-[padding,background-color] duration-300 ${
        transparent
          ? "bg-transparent py-6 text-white"
          : "bg-white text-black py-6"
      }`}
      ref={ref}
    >
      <h1
        className="font-bold font-berlingske text-[24pt] cursor-pointer text-nowrap"
        onClick={() => {
          navigate("/");
        }}
      >
        THE ALLIANCE
      </h1>
      <div className="flex flex-row items-center gap-x-10">
        {links.map((link) => (
          // link == NavbarPage.Guide ? (
          //   <Link to={destinations[link]} key={link}>
          //     <p
          //       className={`${
          //         transparent
          //           ? " hover:bg-white hover:text-black"
          //           : " hover:bg-white hover:text-black"
          //       } rounded-md py-1 px-4 whitespace-nowrap `}
          //     >
          //       {link}
          //     </p>
          //   </Link>
          // ) : (
          <Link to={destinations[link]} key={link}>
            <p className="hover:underline whitespace-nowrap">{link}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default PrelaunchNavbar;

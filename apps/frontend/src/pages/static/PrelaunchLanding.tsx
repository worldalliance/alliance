import React, { useEffect, useRef, useState } from "react";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import HighResGlobe from "../../components/HighResGlobe";

const PrelaunchLandingPage: React.FC = () => {
  const [size, setSize] = useState(500);
  const [navbarHeight, setNavbarHeight] = useState(0);
  const navbarRef = useRef<HTMLDivElement>(null);
  const [scrolled, _] = useState(false);

  useEffect(() => {
    setNavbarHeight(navbarRef.current?.clientHeight || 0);
  }, [navbarRef]);

  const color1 = `hsl(125, 100%, 50%)`;
  const color2 = `hsl(305, 100%, 50%)`;

  return (
    <div>
      <PrelaunchNavbar transparent={true} />
      <div
        className="flex flex-col items-center justify-center bg-gray-950 w-screen h-[calc(100vh)] overflow-hidden relative goob"
        style={{
          marginTop: `-${navbarHeight}px`,
        }}
      >
        <div className="mb-[-40%]" suppressHydrationWarning={true}>
          <HighResGlobe width={size} height={size} />
        </div>
        <div className="absolute top-0 left-0 right-0 bottom-0 grain"></div>
        <div
          className="absolute top-0 left-0 right-0 bottom-0 mix-blend-overlay opacity-20"
          style={{
            background: `radial-gradient(circle at 20% 20%, ${color1} 10%, ${color2} 100%)`,
          }}
        ></div>
        <div className="absolute top-0 left-0 right-0 bottom-0 bg-linear-to-t from-black to-transparent opacity-50"></div>

        <h2 className="w-1/2 absolute bottom-25 text-white !text-7xl font-sabon">
          Global citizens acting as one for a conscionable world.
        </h2>
        {/* <img
          src={dropDownArrow}
          alt="arrow down"
          className="w-10 absolute bottom-5 invert"
        /> */}
        {/* </div> */}
      </div>
    </div>
  );
};

export default PrelaunchLandingPage;

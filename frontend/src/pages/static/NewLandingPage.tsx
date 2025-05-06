import React, { useEffect, useRef, useState } from "react";
import HighResGlobe from "../../components/HighResGlobe";
import PlatformUIDemoCard from "../../components/PlatformUIDemoCard";
import NewNavbar from "../../components/NewNavbar";
import LandingPageActionCard from "../../components/LandingPageActionCard";
import dropDownArrow from "../../assets/icons8-expand-arrow-96.png";
import Footer from "../../components/Footer";

const NewLandingPage: React.FC = () => {
  const size = 2 * window.innerHeight;
  const [scrollOffset, setScrollOffset] = useState(0);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const navbarRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (mainContentRef.current && navbarRef.current) {
      setScrollOffset(
        mainContentRef.current.offsetTop -
          (navbarRef.current.clientHeight * 2) / 3
      );
    }
  }, [mainContentRef, navbarRef]);

  const handleScroll = () => {
    const scrollPosition = window.scrollY;
    setScrolled(scrollPosition >= scrollOffset);
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  return (
    <div>
      <NewNavbar inverted={scrolled} ref={navbarRef} />
      <div className="flex flex-col items-center justify-center bg-gray-950 w-screen h-screen overflow-hidden relative goob">
        <div className="mb-[-50%]">
          <HighResGlobe width={size} height={size} />
        </div>
        <div className="absolute top-0 left-0 right-0 bottom-0 grain"></div>
        <div className="absolute top-0 left-0 right-0 bottom-0 coloroverlay mix-blend-overlay"></div>
        {/* <div className="absolute bottom-0 left-0 right-0 top-0 m-auto justify-center items-center flex flex-col text-white"> */}
        {/* <p
            className="font-bold font-berlingske !text-[60pt]"
            style={{ filter: "drop-shadow(#00000022 0px 10px 30px)" }}
          >
            the alliance
          </p> */}
        <img
          src={dropDownArrow}
          alt="arrow down"
          className="w-10 absolute bottom-5 invert"
        />
        {/* </div> */}
      </div>
      <div
        className="bg-white w-screen py-20 flex flex-col items-center"
        ref={mainContentRef}
      >
        <div className="container mx-auto flex flex-col items-center gap-y-15">
          <h2 className="text-black !text-[24pt] font-bold">
            A platform for global collective action
          </h2>
          <div className="flex flex-col md:flex-row gap-4 max-w-[100%] justify-center">
            <PlatformUIDemoCard idx={0} />
            <PlatformUIDemoCard idx={1} />
            <PlatformUIDemoCard idx={2} />
          </div>
          <h2 className="text-black !text-[24pt] font-bold mt-5">
            What we're doing
          </h2>
          <div className="flex flex-col gap-y-5 min-w-[500px]">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <LandingPageActionCard
                key={idx}
                title="title"
                description="description"
                category="category"
              />
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default NewLandingPage;

import React, { useEffect, useRef, useState } from "react";
import HighResGlobe from "../../components/HighResGlobe";
import PlatformUIDemoCard from "../../components/PlatformUIDemoCard";
import NewNavbar from "../../components/NewNavbar";
import dropDownArrow from "../../assets/icons8-expand-arrow-96.png";
import Footer from "../../components/Footer";
import LineHeader from "../../components/LineHeader";
import Card, { CardStyle } from "../../components/system/Card";

const NewLandingPage: React.FC = () => {
  const size = 2 * Math.min(window.innerWidth, window.innerHeight);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [navbarHeight, setNavbarHeight] = useState(0);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const navbarRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrollOffsetThreshold = 30;

  useEffect(() => {
    if (mainContentRef.current && navbarRef.current) {
      setScrollOffset(
        mainContentRef.current.offsetTop - navbarRef.current.clientHeight * 2
      );
    }
  }, [mainContentRef, navbarRef]);

  const handleScroll = () => {
    const scrollPosition = window.scrollY;
    if (!scrolled && scrollPosition >= scrollOffset + scrollOffsetThreshold) {
      setScrolled(true);
    } else if (
      scrolled &&
      scrollPosition < scrollOffset - scrollOffsetThreshold
    ) {
      setScrolled(false);
    }
  };

  useEffect(() => {
    setNavbarHeight(navbarRef.current?.clientHeight || 0);
  }, [navbarRef]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  const color1 = `hsl(${Math.random() * 180}, 100%, 50%)`;
  const color2 = `hsl(${Math.random() * 180 + 180}, 100%, 50%)`;

  // lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

  return (
    <div>
      <NewNavbar transparent={!scrolled} ref={navbarRef} />
      <div
        className="flex flex-col items-center justify-center bg-gray-950 w-screen h-[101vh] overflow-hidden relative goob"
        style={{
          transform: `translateY(-${navbarHeight}px)`,
        }}
      >
        <div className="mb-[-40%]">
          <HighResGlobe width={size} height={size} />
        </div>
        <div className="absolute top-0 left-0 right-0 bottom-0 grain"></div>
        <div
          className="absolute top-0 left-0 right-0 bottom-0 mix-blend-overlay opacity-20"
          style={{
            background: `radial-gradient(circle at 20% 20%, ${color1} 10%, ${color2} 100%)`,
          }}
        ></div>
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
        <div className="absolute left-0 top-20 md:top-6 w-10 h-10 p-20 text-center md:text-left">
          <p className="text-white min-w-[300px]">
            An online democratic polity to facilitate global coordination.
          </p>
        </div>
        {/* </div> */}
      </div>
      <div
        className="bg-white w-screen flex flex-col items-center"
        ref={mainContentRef}
      >
        <div className="container mx-auto flex flex-col items-center gap-y-15">
          <LineHeader title="Participate in collective actions" />
          <div className="flex flex-col md:flex-row gap-4 max-w-[100%] justify-center">
            <PlatformUIDemoCard idx={0} size="large" />
            <PlatformUIDemoCard idx={1} size="small" />
            <PlatformUIDemoCard idx={2} size="small" />
          </div>
          <LineHeader title="Deliberate on important issues" />
          <div className="flex flex-col md:flex-row gap-4 max-w-[100%] justify-center">
            <PlatformUIDemoCard idx={2} size="small" />
            <PlatformUIDemoCard idx={2} size="large" />
            <PlatformUIDemoCard idx={0} size="small" />
          </div>
          <LineHeader title="What we've done so far" />
          <div className="flex flex-col md:flex-row gap-4 w-[100%] justify-center">
            <Card
              style={CardStyle.Grey}
              className="!p-0 overflow-hidden w-[25%] aspect-square"
            ></Card>
            <Card
              style={CardStyle.Grey}
              className="!p-0 overflow-hidden w-[25%] aspect-square"
            ></Card>
            <Card
              style={CardStyle.Grey}
              className="!p-0 overflow-hidden w-[25%] aspect-square"
            ></Card>
            <Card
              style={CardStyle.Grey}
              className="!p-0 overflow-hidden w-[25%] aspect-square"
            ></Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default NewLandingPage;

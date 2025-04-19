import React, { useCallback } from "react";
import godImage from "../assets/god.png";
import { useNavigate } from "react-router-dom";

interface LogoProps {
  href?: string;
}

const Logo: React.FC<LogoProps> = ({ href }) => {
  const navigate = useNavigate();

  const clickHandler = useCallback(() => {
    if (href) {
      navigate(href);
    }
  }, [href, navigate]);

  return (
    <div onClick={clickHandler} className={`${href ? "cursor-pointer" : ""}`}>
      <img src={godImage} alt="logo" className="w-[40px]" />
    </div>
  );
};

export default Logo;

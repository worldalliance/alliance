import React, { useCallback } from "react";
import godImage from "../assets/god.png";
import { useNavigate } from "react-router-dom";

interface LogoProps {
  href?: string;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ href, className }) => {
  const navigate = useNavigate();

  const clickHandler = useCallback(() => {
    if (href) {
      navigate(href);
    }
  }, [href, navigate]);

  return (
    <img
      src={godImage}
      onClick={clickHandler}
      alt="logo"
      className={`${href ? "cursor-pointer" : ""} ${className} aspect-square w-[30px] `}
    />
  );
};

export default Logo;

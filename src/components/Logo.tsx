import React from "react";
import godImage from "../assets/god.png";

const Logo: React.FC = () => {
  return (
    <div>
      <img src={godImage} alt="logo" className="w-[40px]" />
    </div>
  );
};

export default Logo;

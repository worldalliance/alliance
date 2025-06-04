import React, { useCallback } from "react";
import { useNavigate } from "react-router";
import Card, { CardStyle } from "./system/Card";
import bgImage from "../assets/fakebgimage.png";

export interface IssueCardProps {
  name: string;
  description: string;
  href: string;
}

const IssueCard: React.FC<IssueCardProps> = ({ name, description, href }) => {
  const navigate = useNavigate();

  const handleClick = useCallback(() => {
    navigate(href);
  }, [href, navigate]);

  return (
    <Card
      className="flex-col flex-nowrap transition-all duration-300 relative !p-8 justify-end min-h-[300px]"
      onClick={handleClick}
      style={CardStyle.Outline}
      bgImage={bgImage}
    >
      <div className="drop-shadow-lg drop-shadow-black/20 space-y-2">
        <h2 className="font-font font-normal !text-4xl drop-shadow-xl drop-shadow-white/40">
          {name}
        </h2>
        <p className="drop-shadow-2xl drop-shadow-white/90 text-bold">
          {description}
        </p>
      </div>
    </Card>
  );
};

export default IssueCard;

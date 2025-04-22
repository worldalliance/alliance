import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Card from "./system/Card";

export interface ProblemAreaCardProps {
  name: string;
  description: string;
  href: string;
}

const ProblemAreaCard: React.FC<ProblemAreaCardProps> = ({
  name,
  description,
  href,
}) => {
  const navigate = useNavigate();

  const handleClick = useCallback(() => {
    navigate(href);
  }, [href, navigate]);

  return (
    <Card
      className="mb-2.5 w-[500px] flex-col flex-nowrap space-y-3 transition-all duration-300"
      onClick={handleClick}
    >
      <p className="font-font font-normal text-[13pt]">{name}</p>
      <p>{description}</p>
    </Card>
  );
};

export default ProblemAreaCard;

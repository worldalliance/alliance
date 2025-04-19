import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";

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
    <div
      className="flex p-5 rounded-lg bg-white shadow-sm border border-gray-200 mb-2.5 w-[500px] flex-col flex-nowrap space-y-3 hover:bg-gray-50 cursor-pointer transition-all duration-300"
      onClick={handleClick}
    >
      <p className="font-font font-normal text-[13pt]">{name}</p>
      <p>{description}</p>
    </div>
  );
};

export default ProblemAreaCard;

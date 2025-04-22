import { PropsWithChildren } from "react";

export interface CardProps extends PropsWithChildren {
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className, onClick }) => {
  return (
    <div
      className={`flex flex-col bg-white rounded-lg p-4 border border-gray-200 ${className} ${onClick ? "cursor-pointer hover:bg-gray-50" : ""}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;

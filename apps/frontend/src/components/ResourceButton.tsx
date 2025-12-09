import chevronRight from "../assets/icons8-expand-arrow-96.png";
import { Link } from "react-router";

export interface ResourceButtonProps {
  children: React.ReactNode;
  className?: string;
  to: string;
}

const ResourceButton = ({ children, className, to }: ResourceButtonProps) => {
  return (
    <Link
      to={to}
      className={`border border-zinc-200 hover:bg-zinc-50 p-4 text-lg w-full ${className}`}
    >
      <div className="flex flex-row items-center justify-between w-full">
        {children}
        <img src={chevronRight} className="w-4 h-4 rotate-270" />
      </div>
    </Link>
  );
};

export default ResourceButton;

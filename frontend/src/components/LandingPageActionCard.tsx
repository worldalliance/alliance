import React from "react";
import Badge from "./system/Badge";
import Card, { CardStyle } from "./system/Card";

interface LandingPageActionCardProps {
  title: string;
  description: string;
  category: string;
  className?: string;
}

const LandingPageActionCard: React.FC<LandingPageActionCardProps> = ({
  title,
  description,
  category,
  className,
}) => {
  return (
    <div className={`relative ${className}`}>
      {/* <StatusIndicator status={Status.InProgress} /> */}
      <Card
        style={CardStyle.Grey}
        className="block bg-stone-50 text-[11pt] font-avenir min-h-[100px] min-w-[600px]"
      ></Card>
    </div>
  );
};

export default LandingPageActionCard;

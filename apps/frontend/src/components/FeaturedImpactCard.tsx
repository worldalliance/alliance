import React from "react";
import { href } from "react-router";
import type { FeaturedImpactAction } from "../content/featuredImpactActions";
import ProgressCard from "./ProgressCard";

const FeaturedImpactCard: React.FC<
  FeaturedImpactAction & { bgColor?: "grey" | "white" }
> = ({
  actionId,
  emphasis,
  rest,
  imageSrc,
  imageAlt,
  customLink,
  bgColor = "white",
}) => {
  const external = Boolean(customLink?.startsWith("http"));
  const to = customLink ?? href("/actions/:id", { id: actionId.toString() });

  return (
    <ProgressCard
      to={to}
      title={emphasis}
      description={rest}
      imageSrc={imageSrc}
      imageAlt={imageAlt}
      external={external}
      bgColor={bgColor}
    />
  );
};

export default FeaturedImpactCard;

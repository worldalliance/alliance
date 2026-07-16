import { cn } from "@alliance/shared/styles/util";
import React from "react";
import { Link, href } from "react-router";
import type { FeaturedImpactAction } from "../content/featuredImpactActions";

const FeaturedImpactCard: React.FC<
  FeaturedImpactAction & { bgColor?: "grey" | "white" }
> = ({
  actionId,
  emphasis,
  rest,
  bgColor = "grey",
  imageSrc,
  imageAlt,
  customLink,
}) => {
  const cardStyle = bgColor === "grey" ? "bg-grey-0" : "bg-white";
  return (
    <Link
      to={
        customLink
          ? customLink
          : href("/actions/:id", { id: actionId.toString() })
      }
      className={cn(
        "flex flex-col overflow-hidden rounded-md group hover:border-grey-3",
        cardStyle,
      )}
    >
      {imageSrc ? (
        <div className="aspect-[16/10] w-full shrink-0 bg-zinc-100">
          <img
            src={imageSrc}
            alt={imageAlt ?? ""}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-4 p-4 sm:p-8">
        <p className="text-lg text-zinc-500 lg:text-xl">
          <span className="font-semibold text-black group-hover:underline">
            {emphasis}
          </span>{" "}
          {rest}
        </p>
      </div>
    </Link>
  );
};

export default FeaturedImpactCard;

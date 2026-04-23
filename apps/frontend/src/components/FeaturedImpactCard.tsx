import React from "react";
import { Link, href } from "react-router";
import type { FeaturedImpactAction } from "../content/featuredImpactActions";

const FeaturedImpactCard: React.FC<FeaturedImpactAction> = ({
  actionId,
  emphasis,
  rest,
}) => {
  return (
    <Link
      to={href("/actions/:id", { id: actionId.toString() })}
      className="flex flex-col gap-4 bg-grey-0 group hover:border-grey-3 rounded-md p-4 sm:p-8"
    >
      <p className="text-lg text-zinc-500 lg:text-xl">
        <span className="font-semibold text-black group-hover:underline">
          {emphasis}
        </span>{" "}
        {rest}
      </p>
    </Link>
  );
};

export default FeaturedImpactCard;

import { cn } from "@alliance/shared/styles/util";
import { ChevronRight } from "lucide-react";
import React from "react";
import { Link } from "react-router";

export type ProgressCardProps = {
  to: string;
  title: string;
  description?: string;
  meta?: string;
  imageSrc?: string;
  imageAlt?: string;
  external?: boolean;
  bgColor?: "grey" | "white";
  className?: string;
};

const ProgressCard: React.FC<ProgressCardProps> = ({
  to,
  title,
  description,
  meta,
  imageSrc,
  imageAlt,
  external = false,
  bgColor = "white",
  className,
}) => {
  const classNames = cn(
    "group flex flex-col overflow-hidden rounded-lg border",
    "transition-[border-color,background-color] duration-150",
    bgColor === "grey"
      ? "bg-grey-0 border-zinc-200 hover:border-zinc-300"
      : "bg-white border-zinc-200 hover:border-zinc-300",
    className,
  );

  const body = (
    <>
      {imageSrc ? (
        <div className="aspect-16/10 w-full shrink-0 bg-zinc-100">
          <img
            src={imageSrc}
            alt={imageAlt ?? ""}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-row items-start gap-3 p-5 sm:p-6">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* {meta ? <p className="text-sm text-zinc-500">{meta}</p> : null} */}
          <p className="text-lg font-semibold text-black group-hover:underline lg:text-xl text-pretty">
            {title}
          </p>
          {description ? (
            <p className="text-base text-zinc-500 lg:text-lg text-pretty">
              {description}
            </p>
          ) : null}
        </div>
        <ChevronRight
          className="mt-1 h-5 w-5 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-700"
          aria-hidden
        />
      </div>
    </>
  );

  if (external) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        className={classNames}
      >
        {body}
      </a>
    );
  }

  return (
    <Link to={to} className={classNames}>
      {body}
    </Link>
  );
};

export default ProgressCard;

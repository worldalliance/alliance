import { cn } from "./cn";

export interface CenterLayoutProps extends React.PropsWithChildren {
  className?: string;
  width?: "4xl" | "3xl";
}

const CenterLayout = ({
  children,
  className,
  width = "3xl",
}: CenterLayoutProps) => (
  <div
    className={cn(
      "mx-auto flex flex-col px-page pt-page-top pb-10",
      width === "4xl" ? "max-w-4xl" : "max-w-3xl",
      className,
    )}
  >
    {children}
  </div>
);

export default CenterLayout;

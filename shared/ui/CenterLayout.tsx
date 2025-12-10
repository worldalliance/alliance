import BottomSpacer from "./BottomSpacer";

export interface CenterLayoutProps extends React.PropsWithChildren {
  className?: string;
  width?: "4xl" | "3xl";
}

const CenterLayout: React.FC<CenterLayoutProps> = ({
  children,
  className,
  width = "3xl",
}) => {
  return (
    <div
      className={`flex flex-col ${
        width === "4xl" ? "max-w-4xl" : "max-w-3xl"
      } mx-auto px-3 py-3 md:py-12 ${className}`}
    >
      {children}
      <BottomSpacer />
    </div>
  );
};

export default CenterLayout;

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
      } mx-auto px-3 pt-3 md:pt-12 ${className}`}
    >
      {children}
      <div className="h-15 block md:h-5"></div>
    </div>
  );
};

export default CenterLayout;

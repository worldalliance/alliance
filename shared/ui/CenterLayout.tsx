export interface CenterLayoutProps extends React.PropsWithChildren {
  className?: string;
  width?: "4xl" | "3xl";
}

const CenterLayout: React.FC<CenterLayoutProps> = ({
  children,
  className,
  width = "4xl",
}) => {
  return (
    <div
      className={`flex flex-col ${width === "4xl" ? "max-w-4xl" : "max-w-3xl"} mx-auto px-3 pt-3 md:pt-12 ${className}`}
    >
      {children}
    </div>
  );
};

export default CenterLayout;

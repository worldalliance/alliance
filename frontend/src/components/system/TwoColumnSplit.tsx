interface TwoColumnSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

const TwoColumnSplit = ({ left, right }: TwoColumnSplitProps) => {
  return (
    <div className="flex flex-row min-h-screen w-full h-full justify-center bg-pagebg">
      <div className="flex flex-col flex-2 border-r border-zinc-400">
        {left}
      </div>
      <div className="flex-col gap-y-5 items-stretch flex-1 max-w-[350px] h-full p-8 bg-[#c4d8bf] min-h-[100vh] hidden sm:flex">
        {right}
      </div>
    </div>
  );
};

export default TwoColumnSplit;

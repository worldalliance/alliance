const LineHeader = ({ title }: { title: string }) => {
  return (
    <div className="w-full">
      <h2 className="text-black !text-[24pt]">{title}</h2>
      <div className="w-full h-[1px] bg-gray-400"></div>
    </div>
  );
};

export default LineHeader;

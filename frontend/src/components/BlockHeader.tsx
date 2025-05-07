const BlockHeader = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="w-[50%] p-4 bg-hgreen relative">
      <div className="bg-hgreen absolute right-0 top-0 w-12 h-full transform ml-15 translate-x-full"></div>
      {/* <div className="bg-hgreen absolute right-0 top-0 w-12 h-full transform translate-x-full"></div> */}
      <h2 className="text-white">{children}</h2>
    </div>
  );
};

export default BlockHeader;

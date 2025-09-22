export interface ListProps extends React.PropsWithChildren {
  className?: string;
}

const List: React.FC<ListProps> = ({ children, className }) => {
  return (
    <div
      className={`flex flex-col divide-y divide-zinc-200 border border-zinc-200 rounded overflow-hidden bg-white ${className}`}
    >
      {children}
    </div>
  );
};

export default List;

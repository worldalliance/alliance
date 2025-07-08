export interface ExampleActionCategoryCardProps {
  title: string;
  description: string;
}

const ExampleActionCategoryCard: React.FC<ExampleActionCategoryCardProps> = ({
  title,
  description,
}: ExampleActionCategoryCardProps) => {
  return (
    <div className="flex flex-col border border-zinc-200 rounded p-3 md:p-6 bg-white md:!py-5">
      <p className="text-xl font-bold mb-2">{title}</p>
      <p className="text-lg">{description}</p>
    </div>
  );
};

export default ExampleActionCategoryCard;

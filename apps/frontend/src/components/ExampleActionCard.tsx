interface ExampleActionCardProps {
  name: string;
  description: string;
  purpose?: string;
}

const ExampleActionCard: React.FC<ExampleActionCardProps> = ({
  name,
  description,
  purpose,
}: ExampleActionCardProps) => {
  return (
    <div key={name} className="p-4">
      <div className="flex-1 flex flex-col">
        <div className="flex flex-row items-center justify-between gap-x-2">
          <p className="font-semibold text-green">{name}</p>
        </div>
        <p className="text-zinc-500">{description}</p>

        {purpose && <p className="text-zinc-500">{purpose}</p>}
      </div>
    </div>
  );
};

export default ExampleActionCard;

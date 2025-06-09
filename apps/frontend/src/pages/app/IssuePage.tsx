import { useParams } from "react-router";

const IssuePage: React.FC = () => {
  const { id } = useParams();

  return (
    <div className="flex flex-row container">
      <p>{id}</p>
    </div>
  );
};

export default IssuePage;

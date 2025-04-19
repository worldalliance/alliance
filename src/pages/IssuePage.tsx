import Navbar from "../components/Navbar";
import { NavbarPage } from "../components/Navbar";
import { useParams } from "react-router-dom";

const IssuePage: React.FC = () => {
  const { issue } = useParams();

  return (
    <div className="flex flex-row min-h-screen">
      <Navbar currentPage={NavbarPage.CurrentIssues} />
      <p>{issue}</p>
    </div>
  );
};

export default IssuePage;

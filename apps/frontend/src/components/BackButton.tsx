import Button, { ButtonColor } from "./system/Button";
import { useNavigate } from "react-router-dom";
import backArrow from "../../assets/icons8-expand-arrow-96.png";

const BackButton = () => {
  const navigate = useNavigate();
  return (
    <Button
      color={ButtonColor.Outline}
      onClick={() => navigate(-1)}
      className="!p-[10px] rounded-full"
    >
      <img src={backArrow} alt="back" className="w-5 h-5 rotate-90" />
    </Button>
  );
};

export default BackButton;

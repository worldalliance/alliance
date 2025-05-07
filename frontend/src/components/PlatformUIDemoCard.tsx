import Card, { CardStyle } from "./system/Card";
import uistuff from "../assets/uistuff.png";
import uistuff2 from "../assets/uistuff2.png";
import uistuff3 from "../assets/uistuff3.png";

const images = [uistuff2, uistuff3, uistuff];
const titles = [
  "Alliance experts propose an action",
  "Commit to participate",
  "See immediate results",
];

const cardSizes = {
  small: "w-[300px]",
  large: "w-[600px]",
};

const PlatformUIDemoCard = ({
  idx,
  size,
}: {
  idx: number;
  size: "small" | "large";
}) => {
  return (
    <div className={`${cardSizes[size]} items-center`}>
      <Card
        style={CardStyle.Black}
        className="w-full !p-0 overflow-hidden h-[300px]"
      >
        <p className="font-font text-xl font-bold p-5 pb-3 text-left">
          {titles[idx]}
        </p>
        <img
          src={images[idx]}
          className="w-full aspect-square object-cover left-0 top-0"
        ></img>
      </Card>
    </div>
  );
};

export default PlatformUIDemoCard;

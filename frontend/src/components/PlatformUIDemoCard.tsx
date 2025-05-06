import Card, { CardStyle } from "./system/Card";
import uistuff from "../assets/uistuff.png";
import uistuff2 from "../assets/uistuff2.png";
import uistuff3 from "../assets/uistuff3.png";

const images = [uistuff, uistuff2, uistuff3];
const titles = [
  "Participate in collective actions",
  "See updates on current events",
  "Deliberate on important issues",
];

const PlatformUIDemoCard = ({ idx }: { idx: number }) => {
  return (
    <div className="w-[400px] items-center">
      <Card style={CardStyle.White} className="w-full !p-0 overflow-hidden">
        {/* <img
          src={images[idx]}
          className="w-full aspect-square object-cover left-0 top-0"
        ></img> */}
      </Card>
      <p className="font-font text-xl font-bold p-5 text-center">
        {titles[idx]}
      </p>
    </div>
  );
};

export default PlatformUIDemoCard;

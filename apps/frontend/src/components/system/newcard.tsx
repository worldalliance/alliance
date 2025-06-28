import { useState } from "react";

const NewCard = () => {
  const [expanded, setExpanded] = useState<boolean>(false);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={`bg-red text-lg ${expanded ? "h-10" : "h-4"}`}
    >
      <h1>hi</h1>
    </div>
  );
};

export default NewCard;

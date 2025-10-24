import DateTimePicker from "@alliance/shared/ui/DateTimePicker";
import TextareaWithHighlights from "../components/TextareaWithHighlights";
import { useState } from "react";

const DateTest = () => {
  const [value, setValue] = useState("Hello, world!");
  const [keywords, setKeywords] = useState(["world"]);
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center">
      <DateTimePicker value={new Date()} onChange={() => {}} />
      <div className="font-sans">
        <TextareaWithHighlights
          value={value}
          onChange={setValue}
          keywords={keywords}
        />
      </div>
    </div>
  );
};

export default DateTest;

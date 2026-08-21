import { cn } from "@alliance/shared/styles/util";
import { DefaultIconProps, sizeClass } from "./icons";

const CreateIcon = ({ size = "small", fill = "black" }: DefaultIconProps) => {
  return (
    <svg
      width="20"
      height="20"
      className={cn(sizeClass[size])}
      viewBox="0 0 54 54"
      fill={fill}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(0.000000,54.000000) scale(0.100000,-0.100000)">
        <path
          d="M309 404 c-112 -111 -129 -132 -142 -178 -20 -71 -9 -81 61 -59 44
14 69 34 177 143 134 136 146 159 105 200 -41 41 -64 29 -201 -106z m172 70
c11 -13 -3 -31 -102 -130 -105 -106 -163 -153 -176 -141 -11 12 27 60 135 170
64 64 120 117 123 117 4 0 12 -7 20 -16z"
        />
        <path
          d="M71 465 c-43 -37 -54 -87 -49 -235 6 -187 21 -202 208 -208 141 -5
195 6 231 44 22 24 24 33 24 137 0 93 -3 112 -15 112 -12 0 -16 -20 -20 -101
-7 -146 -4 -144 -192 -144 -197 0 -188 -9 -188 188 0 188 -2 185 144 192 81 4
101 8 101 20 0 12 -20 16 -106 18 -102 3 -108 2 -138 -23z"
        />
      </g>
    </svg>
  );
};

export default CreateIcon;

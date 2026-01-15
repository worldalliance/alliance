export enum CardStyle {
  White = "white",
  LightGreen = "light-green",
  WhiteSolid = "white-solid",
  Outline = "outline",
  Alert = "alert",
  Grey = "grey",
  LightGrey = "light-grey",
  Black = "black",
  Image = "image",
  Green = "green",
  Transparent = "transparent",
  Navy = "navy",
  Red = "red",
  Orange = "orange",
}

export const cardStyleClasses: Record<CardStyle, string> = {
  [CardStyle.White]: "bg-white border-zinc-200 border-box",
  [CardStyle.WhiteSolid]: "bg-white border-none",
  [CardStyle.Alert]: "bg-sky-100 border-sky-300",
  [CardStyle.Outline]: "bg-transparent border-zinc-200 hover:bg-zinc-100",
  [CardStyle.Grey]: "bg-zinc-50 border-zinc-200 border-solid",
  [CardStyle.Navy]: "bg-navy text-white border-none rounded-none",
  [CardStyle.LightGrey]: "bg-[#fcfcfc] border-zinc-300",
  [CardStyle.Orange]: "bg-orange-100 border-0",
  [CardStyle.Black]: "bg-black border-zinc-300 text-white",
  [CardStyle.Image]: "bg-transparent border-none",
  [CardStyle.Green]: "bg-green/20 border-green",
  [CardStyle.Transparent]:
    "bg-transparent border-gray-2 hover:border border-box",
  [CardStyle.LightGreen]: "bg-green/10 border-green/30",
  [CardStyle.Red]: "bg-red-100 border-red-300",
};

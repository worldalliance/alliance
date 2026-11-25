import { PropsWithChildren } from "react";
import Card, { CardProps } from "./Card";
import { cn } from "./cn";

export interface DropdownProps extends Pick<CardProps, "ref" | "className"> {
  isOpen: boolean;
}

const Dropdown = ({
  isOpen,
  children,
  className,
  ref,
}: PropsWithChildren<DropdownProps>) =>
  isOpen ? (
    <Card
      className={cn("z-10 rounded-md border-transparent shadow-pop", className)}
      ref={ref}
    >
      {children}
    </Card>
  ) : null;

export default Dropdown;

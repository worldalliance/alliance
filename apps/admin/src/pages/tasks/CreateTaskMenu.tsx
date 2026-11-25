import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ButtonVariant, buttonVariants } from "../../ui/Button";
import { cn } from "../../ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/DropdownMenu";
import { PasteTaskDialog } from "./PasteTaskDialog";

export function CreateTaskMenu() {
  const navigate = useNavigate();
  const [pasting, setPasting] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex",
            buttonVariants({ variant: ButtonVariant.Primary, size: "medium" }),
          )}
        >
          Create
          <ChevronDown aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onClick={() => void navigate("/tasks/new")}>
            New task
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void navigate("/tasks/suites/new")}>
            New suite…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPasting(true)}>
            Paste JSON…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {pasting && <PasteTaskDialog onClose={() => setPasting(false)} />}
    </>
  );
}

import { R } from "@alliance/common/result";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from "@alliance/sharedweb/ui/DropdownMenu";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Menu } from "@base-ui/react/menu";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import { primaryButtonClass } from "./ui/controlStyles";

const CreateActionMenu = () => {
  const navigate = useNavigate();
  const { pasteActionJson } = useActionAdmin(null);
  const { error, success } = useToast();
  const [pasteJsonLoading, setPasteJsonLoading] = useState(false);

  const handlePasteJson = async () => {
    setPasteJsonLoading(true);
    const result = await R.fromPromiseFn(
      async () => {
        const json = await navigator.clipboard.readText();
        return pasteActionJson(json);
      },
      (thrown) => {
        console.error("Failed to paste action", thrown);
        return thrownRefusalMessage({
          error: thrown,
          fallback: "Could not paste action",
          sessionExpired: sessionExpiredMessage,
        });
      },
    );
    setPasteJsonLoading(false);
    if (result.ok) {
      navigate(`/actions/${result.value.id}`);
      success("Action pasted");
    } else {
      error(result.error);
    }
  };

  return (
    <Menu.Root>
      <Menu.Trigger className={primaryButtonClass}>
        <Plus size={16} aria-hidden />
        Create
      </Menu.Trigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuItem onClick={() => navigate("/actions/new")}>
          New action
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/new-suite")}>
          New suite
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePasteJson} disabled={pasteJsonLoading}>
          Paste JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </Menu.Root>
  );
};

export default CreateActionMenu;

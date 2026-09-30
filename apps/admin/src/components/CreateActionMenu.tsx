import { R } from "@alliance/common/result";
import { actionsPasteJsonAdmin } from "@alliance/shared/client";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { useInvalidateActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
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

const CreateActionMenu = () => {
  const navigate = useNavigate();
  const invalidateActions = useInvalidateActionsAdmin();
  const { error, success } = useToast();
  const [pasteJsonLoading, setPasteJsonLoading] = useState(false);

  const handlePasteJson = async () => {
    setPasteJsonLoading(true);
    const result = await R.fromPromiseFn(
      async () => {
        const json = await navigator.clipboard.readText();
        return actionsPasteJsonAdmin({
          body: { body: json },
          throwOnError: true,
        });
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
      void invalidateActions();
      navigate(`/actions/${result.value.data.id}`);
      success("Action pasted successfully");
    } else {
      error(result.error);
    }
  };

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Create"
        title="Create"
        className="shrink-0 rounded border border-green bg-green p-1 text-white hover:bg-[#4d8c1d] cursor-pointer"
      >
        <Plus size={16} />
      </Menu.Trigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuItem onClick={() => navigate("/actions/new")}>
          New Action
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/new-suite")}>
          New Suite
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePasteJson} disabled={pasteJsonLoading}>
          Paste JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </Menu.Root>
  );
};

export default CreateActionMenu;

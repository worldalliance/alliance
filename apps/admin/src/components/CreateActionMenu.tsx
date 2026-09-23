import { actionsPasteJsonAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from "@alliance/sharedweb/ui/DropdownMenu";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Menu } from "@base-ui/react/menu";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

const CreateActionMenu = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { error, success } = useToast();
  const [pasteJsonLoading, setPasteJsonLoading] = useState(false);

  const handlePasteJson = async () => {
    setPasteJsonLoading(true);
    const json = await navigator.clipboard.readText();

    const response = await actionsPasteJsonAdmin({ body: { body: json } });
    if (response.data) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.actionsAllAdmin(),
      });
      navigate(`/actions/${response.data.id}`);
      success("Action pasted successfully");
    } else {
      error("Could not paste action");
    }
    setPasteJsonLoading(false);
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

import { clipboardCopy } from "@alliance/shared/lib/copy";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Dropdown from "@alliance/sharedweb/ui/Dropdown";
import LargeCheckbox from "@alliance/sharedweb/ui/LargeCheckbox";
import { Copy } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router";
import { ActionProjectControls } from "../../components/ActionProjectControls";
import { imageUploadingMessage } from "./actionSaveErrors";
import type { ActionExport } from "./useActionExport";

type ActionDashboardToolbarProps = {
  action: ParsedActionDto;
  actionExport: ActionExport;
  imageUploading: boolean;
  onDuplicate: () => Promise<void>;
  onArchive: () => Promise<void>;
};

const ActionDashboardToolbar: React.FC<ActionDashboardToolbarProps> = ({
  action,
  actionExport: {
    exportActionOpen,
    exportActionEvents,
    setExportActionEvents,
    exportActionTaskForm,
    setExportActionTaskForm,
    exportActionSuite,
    setExportActionSuite,
    jsonCopied,
    handleExportActionOpen,
    handleExportAction,
  },
  imageUploading,
  onDuplicate,
  onArchive,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-row gap-2 flex-wrap">
      <ActionProjectControls
        actionId={action.id}
        project={action.project ?? null}
      />
      {action.suite !== undefined && (
        <Button
          onClick={() => {
            navigate(`/suites/${action.suite!.id}`);
          }}
          color={ButtonColor.White}
          className="!px-3 !text-sm gap-x-1"
        >
          Open Suite
        </Button>
      )}
      <Button
        onClick={() => onDuplicate()}
        disabled={imageUploading}
        title={imageUploading ? imageUploadingMessage : undefined}
        color={ButtonColor.White}
        className="!px-3 !text-sm gap-x-1"
      >
        <Copy className="h-5 w-5" />
        Duplicate Action
      </Button>
      <div className="relative">
        <Button
          onClick={handleExportActionOpen}
          color={ButtonColor.White}
          className="!px-3 !text-sm gap-x-1 disabled"
        >
          Export JSON
        </Button>
        {exportActionOpen && (
          <Dropdown
            isOpen={exportActionOpen}
            className="absolute top-[100%] right-0 gap-y-2 min-w-[150px]"
          >
            <div className="flex flex-col gap-y-2">
              <LargeCheckbox
                label="Events"
                checked={exportActionEvents}
                onChange={(checked) => setExportActionEvents(checked)}
              />
              <LargeCheckbox
                label="Task Form"
                checked={exportActionTaskForm}
                onChange={(checked) => setExportActionTaskForm(checked)}
              />
              <LargeCheckbox
                label="Suite"
                checked={exportActionSuite}
                onChange={(checked) => setExportActionSuite(checked)}
              />
            </div>
            <Button
              color={ButtonColor.Black}
              onClick={handleExportAction}
              disabled={jsonCopied}
              className="text-nowrap"
            >
              {jsonCopied
                ? clipboardCopy.inClipboard
                : clipboardCopy.exportJson}
            </Button>
          </Dropdown>
        )}
      </div>
      <Button
        onClick={() => onArchive()}
        color={ButtonColor.RedOutline}
        className="!px-3 !text-sm gap-x-1 bg-white hover:bg-red-50"
      >
        {action.archived ? "Unarchive Action" : "Archive Action"}
      </Button>
    </div>
  );
};

export default ActionDashboardToolbar;

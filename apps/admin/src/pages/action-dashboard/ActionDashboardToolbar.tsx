import { clipboardCopy } from "@alliance/shared/lib/copy";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { Copy } from "lucide-react";
import React from "react";
import { Link, useNavigate } from "react-router";
import { ActionProjectControls } from "../../components/ActionProjectControls";
import { stepPath } from "../../components/ProjectStepRows";
import Button, { ButtonColor } from "../../ui/Button";
import Dropdown from "../../ui/Dropdown";
import LargeCheckbox from "../../ui/LargeCheckbox";
import { imageUploadingMessage } from "./actionSaveErrors";
import type { ActionExport } from "./useActionExport";

type ActionDashboardToolbarProps = {
  action: ParsedActionDto;
  actionExport: ActionExport;
  imageUploading: boolean;
  unsaved: boolean;
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
  unsaved,
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
      {action.project && (
        <Link
          to={stepPath(action)}
          className="flex items-center gap-x-1 rounded border border-gray-300 bg-white px-3 text-sm hover:bg-gray-50"
        >
          Open in project
        </Link>
      )}
      {action.suite !== undefined && (
        <Button
          onClick={() => {
            navigate(`/suites/${action.suite!.id}`);
          }}
          color={ButtonColor.White}
          className="!px-3 !text-sm gap-x-1"
        >
          Open suite
        </Button>
      )}
      <Button
        onClick={() => onDuplicate()}
        disabled={imageUploading || unsaved}
        title={imageUploading ? imageUploadingMessage : undefined}
        color={ButtonColor.White}
        className="!px-3 !text-sm gap-x-1"
      >
        <Copy className="h-5 w-5" />
        Duplicate action
      </Button>
      {unsaved && (
        <span className="self-center text-sm text-amber-800">
          Save your changes on Action details to duplicate this action.
        </span>
      )}
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
                label="Task form"
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
        {action.archived ? "Unarchive action" : "Archive action"}
      </Button>
    </div>
  );
};

export default ActionDashboardToolbar;

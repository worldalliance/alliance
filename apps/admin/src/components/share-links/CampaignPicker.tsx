import type { CampaignDto } from "@alliance/shared/client/types.gen";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import React from "react";

const CampaignPicker: React.FC<{
  campaigns: CampaignDto[];
  loadError: string | null;
  selectedCampaignId: number | null;
  onSelect: (id: number | null) => void;
  newCampaignName: string;
  onNewCampaignNameChange: (value: string) => void;
  onCreateCampaign: () => void;
  creatingCampaign: boolean;
  picturePreview: string | null;
  onPictureChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({
  campaigns,
  loadError,
  selectedCampaignId,
  onSelect,
  newCampaignName,
  onNewCampaignNameChange,
  onCreateCampaign,
  creatingCampaign,
  picturePreview,
  onPictureChange,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-700">Campaign</label>
        {loadError && <p className="text-xs text-red-500">{loadError}</p>}
        <select
          className="border border-zinc-300 rounded px-3 py-2 text-sm bg-white"
          value={selectedCampaignId ?? ""}
          onChange={(event) =>
            onSelect(event.target.value ? Number(event.target.value) : null)
          }
        >
          <option value="">Select a campaign…</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-700">
          Create a new campaign
        </label>
        <div className="flex flex-row items-center gap-2">
          <input
            type="text"
            className="border border-zinc-300 rounded px-3 py-2 text-sm flex-1"
            placeholder="Campaign name — e.g. Spring fundraiser"
            value={newCampaignName}
            onChange={(event) => onNewCampaignNameChange(event.target.value)}
            disabled={creatingCampaign}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCreateCampaign();
              }
            }}
          />
          <Button
            type="button"
            color={ButtonColor.Blue}
            onClick={onCreateCampaign}
            disabled={creatingCampaign || !newCampaignName.trim()}
            className="shrink-0"
          >
            {creatingCampaign ? "Creating…" : "Create"}
          </Button>
        </div>
        <div className="flex flex-row items-center gap-3 mt-1">
          {picturePreview && (
            <img
              src={picturePreview}
              alt="Campaign avatar preview"
              className="w-10 h-10 rounded-full object-cover border border-zinc-200"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={onPictureChange}
            disabled={creatingCampaign}
            className="text-xs text-zinc-600"
          />
        </div>
      </div>
    </div>
  );
};

export default CampaignPicker;

import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { StaffPreviewService } from "./staff-preview.service";

@Injectable()
export class StaffPreviewWorker {
  constructor(private readonly staffPreviewService: StaffPreviewService) {}

  // Reads are already inert on an opened action, so the interval only bounds
  // how long a spent flag sits in the admin form.
  @Cron("*/10 * * * *")
  async clearOpenedPreviews() {
    await this.staffPreviewService.clearOpenedPreviews();
  }
}

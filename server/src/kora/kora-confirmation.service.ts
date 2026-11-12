import { thrownMessage } from "@alliance/common/errorMessage";
import { Injectable, Logger } from "@nestjs/common";
import { EmailType } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { koraProjectUrl } from "src/search/approutes";
import type { KoraParticipant } from "./entities/kora-participant.entity";
import {
  koraConfirmationEmail,
  koraConfirmationText,
} from "./kora-confirmation-copy";

@Injectable()
export class KoraConfirmationService {
  private readonly logger = new Logger(KoraConfirmationService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
  ) {}

  /** Sends in the background, so a slow or failed delivery never holds up signup. */
  send(participant: KoraParticipant): void {
    this.deliver(participant).catch((error: unknown) =>
      this.logger.error(
        `Confirmation for Kora participant ${participant.id} not sent: ${thrownMessage(error)}`,
      ),
    );
  }

  private async deliver(participant: KoraParticipant): Promise<void> {
    const copy = { name: participant.name, projectUrl: koraProjectUrl() };
    if (participant.email !== null) {
      const { subject, context } = koraConfirmationEmail(copy);
      await this.mailService.sendUnrecordedMail({
        recipient: participant.email,
        emailType: EmailType.KoraSignupConfirmation,
        subject,
        context,
      });
    } else if (participant.phoneNumber !== null) {
      await this.mmsService.sendUnrecordedText({
        to: participant.phoneNumber,
        body: koraConfirmationText(copy),
      });
    } else {
      throw new Error("participant has no contact");
    }
  }
}

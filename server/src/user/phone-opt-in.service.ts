import { Injectable } from "@nestjs/common";
import { MmsService } from "src/mms/mms.service";
import { welcomeMessage } from "src/notifs/textnotifcontents";
import { UserService } from "./user.service";
import { textReachable } from "./user.utils";

@Injectable()
export class PhoneOptInService {
  constructor(
    private readonly userService: UserService,
    private readonly mmsService: MmsService,
  ) {}

  /**
   * Texts the opt-in confirmation to the member's saved number, unless they
   * have opted in, turned texts off, or the number can't be texted. Two calls
   * that overlap while the text is sending can both send it.
   */
  async confirm(userId: number): Promise<void> {
    const user = await this.userService.findOneOrFail(userId, {
      optInMms: true,
    });
    if (user.optInMms || !user.textByDefault || !textReachable(user)) return;
    const mms = await this.mmsService.sendMms({
      to: user.phoneNumber,
      userId,
      body: welcomeMessage,
      mediaUrls: [],
      tracking: null,
    });
    if (mms) await this.userService.setOptInMms(userId, mms.id);
  }
}

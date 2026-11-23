import { PHONE_NUMBER_TAKEN_MESSAGE } from "@alliance/common/phone";
import { ConflictException } from "@nestjs/common";

export class PhoneNumberTakenException extends ConflictException {
  constructor() {
    super(PHONE_NUMBER_TAKEN_MESSAGE);
  }
}

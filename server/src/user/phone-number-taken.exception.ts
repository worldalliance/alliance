import { ConflictException } from "@nestjs/common";

export class PhoneNumberTakenException extends ConflictException {
  constructor() {
    super(
      "This phone number is already linked to an account. Enter a different number.",
    );
  }
}

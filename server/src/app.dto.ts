import { ApiProperty } from "@nestjs/swagger";

export class HealthCheckDto {
  @ApiProperty()
  status: string;

  constructor(status: string) {
    this.status = status;
  }
}

export type MobilePlatformFingerprint = {
  fingerprint: string;
  version: string;
};

export class MobilePlatformFingerprintDto {
  /** EAS Update runtime fingerprint of the store build. */
  @ApiProperty()
  fingerprint: string;

  /** App version (semver) of the store build. */
  @ApiProperty()
  version: string;

  constructor(input: MobilePlatformFingerprint) {
    this.fingerprint = input.fingerprint;
    this.version = input.version;
  }
}

export type MobileFingerprints = {
  ios: MobilePlatformFingerprint;
  android: MobilePlatformFingerprint;
};

/**
 * EAS Update runtime fingerprints and app versions of the mobile builds
 * currently live in the stores. An installed app whose own runtime fingerprint
 * differs — and whose own version is older — can prompt the user to download
 * the new store build. The version comparison is what lets the app tell "I'm
 * behind the store" apart from "the server's baseline is behind me".
 */
export class MobileFingerprintsDto {
  @ApiProperty({ type: () => MobilePlatformFingerprintDto })
  ios: MobilePlatformFingerprintDto;

  @ApiProperty({ type: () => MobilePlatformFingerprintDto })
  android: MobilePlatformFingerprintDto;

  constructor(input: MobileFingerprints) {
    this.ios = new MobilePlatformFingerprintDto(input.ios);
    this.android = new MobilePlatformFingerprintDto(input.android);
  }
}

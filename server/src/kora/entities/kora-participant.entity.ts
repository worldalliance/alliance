import { ApiProperty } from "@nestjs/swagger";
import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { phoneNumberTransformer } from "src/utils/phone";
import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export const KORA_PARTICIPANT_NAME_MAX_LENGTH = 200;

/** Someone taking part in the Kora project without being an Alliance member. */
@Entity()
@Check(
  "CHK_kora_participant_one_contact",
  `("email" IS NULL) <> ("phoneNumber" IS NULL)`,
)
@Check(
  "CHK_kora_participant_phone_e164",
  `"phoneNumber" ~ '^[+][1-9][0-9]{1,14}$'`,
)
@Check("CHK_kora_participant_name_not_blank", `btrim("name") <> ''`)
export class KoraParticipant {
  @PrimaryGeneratedColumn("uuid")
  @ApiProperty()
  id: string;

  @Column({ type: "varchar", length: KORA_PARTICIPANT_NAME_MAX_LENGTH })
  @ApiProperty()
  name: string;

  @Index({ unique: true })
  @Column({ type: "citext", nullable: true })
  email: string | null;

  @Index({ unique: true })
  @Column({
    type: "varchar",
    nullable: true,
    transformer: phoneNumberTransformer,
  })
  phoneNumber: string | null;

  @Column({ type: "varchar", nullable: true })
  timeZone: string | null;

  @Column({ type: "timestamptz" })
  contactVerifiedAt: Date;

  @CreateDateColumnTz()
  createdAt: Date;
}

import { ApiProperty } from "@nestjs/swagger";
import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { phoneNumberTransformer } from "src/utils/phone";
import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** Someone taking part in a project without being an Alliance member. */
@Entity()
@Check(
  "CHK_project_participant_one_contact",
  `("email" IS NULL) <> ("phoneNumber" IS NULL)`,
)
@Check(
  "CHK_project_participant_phone_e164",
  `"phoneNumber" ~ '^[+][1-9][0-9]{1,14}$'`,
)
@Check("CHK_project_participant_name_not_blank", `btrim("name") <> ''`)
export class ProjectParticipant {
  @PrimaryGeneratedColumn("uuid")
  @ApiProperty()
  id: string;

  @Column({ type: "varchar", length: 200 })
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

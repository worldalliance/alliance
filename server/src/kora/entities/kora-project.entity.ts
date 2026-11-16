import { KoraProjectStatus } from "@alliance/common/kora";
import { ApiProperty } from "@nestjs/swagger";
import { Check, Column, Entity, PrimaryColumn } from "typeorm";

export const KORA_PROJECT_ID = 1;

/** The single row holding the Kora project's status; its migration inserts it. */
@Entity()
@Check(`"id" = ${KORA_PROJECT_ID}`)
export class KoraProject {
  @PrimaryColumn({ type: "smallint" })
  id: number;

  @Column({
    type: "enum",
    enum: KoraProjectStatus,
    enumName: "KoraProjectStatus",
    default: KoraProjectStatus.Pending,
  })
  @ApiProperty({ enum: KoraProjectStatus, enumName: "KoraProjectStatus" })
  status: KoraProjectStatus;
}

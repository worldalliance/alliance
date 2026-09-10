import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class InviteMessageTemplate {
  @PrimaryColumn({ type: "varchar", length: 32 })
  id: string;

  @Column({ type: "text" })
  template: string;
}

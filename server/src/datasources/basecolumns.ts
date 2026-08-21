import { CreateDateColumn, UpdateDateColumn } from "typeorm";

export function CreateDateColumnTz() {
  return CreateDateColumn({ type: "timestamptz" });
}

export function UpdateDateColumnTz() {
  return UpdateDateColumn({ type: "timestamptz" });
}

import z from "zod";

export const contractDescriptionItemSchema = z.strictObject({
  point: z.string(),
  subtext: z.string(),
});
export type ContractDescriptionItem = z.infer<
  typeof contractDescriptionItemSchema
>;

export const contractDescriptionSchema = z.array(contractDescriptionItemSchema);
export type ContractDescription = z.infer<typeof contractDescriptionSchema>;

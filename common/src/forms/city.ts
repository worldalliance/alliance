import z from "zod";

export const cityFieldValueSchema = z.strictObject({
  id: z.number(),
  name: z.string(),
  admin1: z.string(),
  countryCode: z.string(),
  countryName: z.string(),
});
export type CityFieldValue = z.infer<typeof cityFieldValueSchema>;

// Stored answers may predate optional keys or contain extra keys, so reads
// accept both.
const storedCityValueSchema = z.looseObject({
  id: z.number(),
  name: z.string(),
  admin1: z.string().optional(),
  countryCode: z.string().optional(),
  countryName: z.string().optional(),
});

export function parseCityValue(value: unknown): CityFieldValue | undefined {
  const parsed = storedCityValueSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const {
    id,
    name,
    admin1 = "",
    countryCode = "",
    countryName = "",
  } = parsed.data;
  return { id, name, admin1, countryCode, countryName };
}

export function formatCityValue(city: CityFieldValue): string {
  const parts = [city.admin1.trim(), city.countryName.trim()].filter(
    (part) => part.length > 0,
  );
  return parts.length > 0 ? `${city.name}, ${parts.join(", ")}` : city.name;
}

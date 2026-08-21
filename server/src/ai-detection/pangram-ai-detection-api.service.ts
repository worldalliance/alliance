import { Injectable, Logger } from "@nestjs/common";
import { PangramAiDetectionResult } from "./ai-detection.types";

type PangramApiResponse = {
  version?: string;
  fraction_ai?: number;
};

@Injectable()
export class PangramAiDetectionApiService {
  private readonly logger = new Logger(PangramAiDetectionApiService.name);
  private readonly endpoint = process.env.PANGRAM_API_URL?.trim()
    ? process.env.PANGRAM_API_URL.trim()
    : "https://text.api.pangram.com/v3";
  private readonly apiKey = process.env.PANGRAM_API_KEY?.trim();

  private normalizeProbability(value: unknown): number | null {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return null;
    }
    if (value < 0) {
      return 0;
    }
    if (value > 1) {
      return value <= 100 ? value / 100 : 1;
    }
    return value;
  }

  async check(text: string): Promise<PangramAiDetectionResult> {
    if (!this.apiKey) {
      throw new Error("PANGRAM_API_KEY is not configured");
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({ text }),
    });

    let data: unknown = null;
    try {
      data = await response.json();
    } catch (error) {
      this.logger.warn(
        `Failed to parse Pangram response as JSON: ${String(error)}`,
      );
    }

    const parsed =
      data && typeof data === "object"
        ? (data as PangramApiResponse & Record<string, unknown>)
        : {};

    if (!response.ok) {
      throw new Error(
        `Pangram request failed with status ${response.status}${response.statusText ? ` (${response.statusText})` : ""}`,
      );
    }

    return {
      probability: this.normalizeProbability(parsed.fraction_ai),
      raw: parsed,
      modelVersion: typeof parsed.version === "string" ? parsed.version : null,
    };
  }
}

import { OTP_CODE_LENGTH } from "@alliance/common/otp";
import { useEffect, useState } from "react";

export const codeDigits = (text: string): string =>
  text.replace(/\D/g, "").slice(0, OTP_CODE_LENGTH);

const secondsUntil = (iso: string): number =>
  Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 1000));

export function useSecondsUntil(iso: string): number {
  const [seconds, setSeconds] = useState(() => secondsUntil(iso));
  useEffect(() => {
    const timer = setInterval(() => setSeconds(secondsUntil(iso)), 1000);
    return () => clearInterval(timer);
  }, [iso]);
  return seconds;
}

import "server-only";

import { SolapiMessageService } from "solapi";
import { env } from "@/lib/env";

let cachedService: SolapiMessageService | null = null;

export function getSolapiService(): SolapiMessageService {
  const apiKey = env.SOLAPI_API_KEY.trim();
  const apiSecret = env.SOLAPI_API_SECRET.trim();

  if (!apiKey || !apiSecret) {
    throw new Error("SOLAPI 키 미설정");
  }

  if (!cachedService) {
    cachedService = new SolapiMessageService(apiKey, apiSecret);
  }

  return cachedService;
}

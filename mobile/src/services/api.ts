import { getAppConfig } from "../types/config";
import { ensureOnline, OFFLINE_MESSAGE } from "./network";

export type DevicePlatform = "ios" | "android" | "unknown";

export interface RegisterDeviceRequest {
  contactId: string;
  fcmToken: string;
  platform: DevicePlatform;
  locale?: string;
}

export interface RegisterDeviceResponse {
  contactId: string;
  platform: DevicePlatform;
  updatedAt: string;
  status: string;
}

export interface DeliveryAckResponse {
  messageId: string;
  status: string;
}

export class ApiError extends Error {
  readonly statusCode?: number;
  readonly retryable: boolean;

  constructor(message: string, statusCode?: number, retryable = false) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

const REGISTER_RETRY_DELAYS_MS = [1000, 2000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapHttpStatusToMessage(status: number): string {
  if (status === 401) {
    return "Authentication failed. Please contact support if this continues.";
  }
  if (status === 404) {
    return "Service not found. Please try again later.";
  }
  if (status === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (status >= 500) {
    return "Server error. Please try again in a few moments.";
  }
  if (status >= 400) {
    return "Request could not be completed. Please check your details and try again.";
  }
  return "Something went wrong. Please try again.";
}

function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof TypeError)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("network request failed") || message.includes("failed to fetch");
}

async function apiFetch<T>(path: string, init: RequestInit): Promise<T> {
  await ensureOnline();

  const config = getAppConfig();

  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const retryable = response.status >= 500 || response.status === 429;
      throw new ApiError(mapHttpStatusToMessage(response.status), response.status, retryable);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (isNetworkFailure(error)) {
      throw new ApiError(OFFLINE_MESSAGE, undefined, true);
    }

    throw new ApiError(
      "Unable to reach the server. Please check your connection and try again.",
      undefined,
      true,
    );
  }
}

async function withRetry<T>(operation: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = error instanceof ApiError && error.retryable;
      if (!retryable || attempt >= retries) {
        break;
      }
      await sleep(REGISTER_RETRY_DELAYS_MS[attempt] ?? 2000);
    }
  }

  throw lastError;
}

export async function registerDevice(
  request: RegisterDeviceRequest,
): Promise<RegisterDeviceResponse> {
  return withRetry(
    () =>
      apiFetch<RegisterDeviceResponse>("/devices/register", {
        method: "POST",
        body: JSON.stringify(request),
      }),
    2,
  );
}

export async function acknowledgeDelivery(messageId: string): Promise<DeliveryAckResponse> {
  return apiFetch<DeliveryAckResponse>("/devices/delivery-ack", {
    method: "POST",
    body: JSON.stringify({ messageId }),
  });
}

export interface DeleteDeviceResponse {
  contactId: string;
  status: string;
}

export async function deleteDevice(contactId: string): Promise<DeleteDeviceResponse> {
  return apiFetch<DeleteDeviceResponse>(`/devices/${encodeURIComponent(contactId)}`, {
    method: "DELETE",
  });
}

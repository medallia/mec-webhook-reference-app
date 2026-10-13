/**
 * Internal device registration model used by the mobile app registration endpoint.
 */

export type DevicePlatform = "ios" | "android" | "unknown";

export interface DeviceRegistration {
  contactId: string;
  fcmToken: string;
  platform: DevicePlatform;
  locale?: string;
  updatedAt: string;
}

export interface DeviceRegisterRequest {
  contactId: string;
  fcmToken: string;
  platform: DevicePlatform;
  locale?: string;
}

export interface DeliveryAckRequest {
  messageId: string;
}

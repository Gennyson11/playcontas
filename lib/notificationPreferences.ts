"use client";

export interface NotificationPreferences {
  siteNotifications: boolean;
  chatMessages: boolean;
  saleApproved: boolean;
  balanceReleased: boolean;
  refund: boolean;
  mediation: boolean;
  newReview: boolean;
  orderUpdates: boolean;
  browserPushEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  siteNotifications: true,
  chatMessages: true,
  saleApproved: true,
  balanceReleased: true,
  refund: true,
  mediation: true,
  newReview: true,
  orderUpdates: true,
  browserPushEnabled: true,
};

export function getPreferencesStorageKey(userId?: string): string {
  return `central_notif_prefs_${userId || "guest"}`;
}

export function getNotificationPreferences(userId?: string): NotificationPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  try {
    const raw = localStorage.getItem(getPreferencesStorageKey(userId));
    if (raw) {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_NOTIFICATION_PREFERENCES };
}

export function saveNotificationPreferences(
  userId: string | undefined,
  prefs: NotificationPreferences
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getPreferencesStorageKey(userId), JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent("central_notif_prefs_updated", { detail: prefs }));
  } catch {}
}

export function shouldNotifyCategory(
  category: keyof NotificationPreferences,
  userId?: string
): boolean {
  const prefs = getNotificationPreferences(userId);
  if (!prefs.siteNotifications) return false;
  return Boolean(prefs[category]);
}

export function sendBrowserPushNotification(
  title: string,
  options?: NotificationOptions,
  userId?: string
): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  const prefs = getNotificationPreferences(userId);
  if (!prefs.browserPushEnabled) return;
  if (Notification.permission !== "granted") return;

  try {
    new Notification(title, {
      icon: "/favicon.ico",
      ...options,
    });
  } catch {}
}

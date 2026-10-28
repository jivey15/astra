import { Platform } from 'react-native';

import { EventItem } from '@/components/event-card';

const REMINDED_IDS_STORAGE_KEY = 'astra_reminded_event_ids_v1';
const BOOKMARKED_EVENTS_STORAGE_KEY = 'astra_bookmarked_events_cache_v1';
const NOTIFICATION_IDS_STORAGE_KEY = 'astra_scheduled_notifications_v1';

// In-memory mirror so reads/writes are always fast and resilient
const memoryStore: Record<string, string> = {};

function getAsyncStorageModule(): any | null {
  try {
    // Dynamically resolve @react-native-async-storage/async-storage if installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage');
    return mod?.default || mod || null;
  } catch {
    return null;
  }
}

function getExpoNotificationsModule(): any | null {
  if (Platform.OS === 'web') return null;
  try {
    // Dynamically resolve expo-notifications on iOS / Android
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications');
    return mod?.default || mod || null;
  } catch {
    return null;
  }
}

export async function storageGetItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    const asyncStorage = getAsyncStorageModule();
    if (asyncStorage && typeof asyncStorage.getItem === 'function') {
      const val = await asyncStorage.getItem(key);
      if (val !== null && val !== undefined) return val;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage.getItem(key);
    }
  } catch {
    // Fallback to memory store
  }
  return memoryStore[key] ?? null;
}

export async function storageSetItem(key: string, value: string): Promise<void> {
  memoryStore[key] = value;
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    const asyncStorage = getAsyncStorageModule();
    if (asyncStorage && typeof asyncStorage.setItem === 'function') {
      await asyncStorage.setItem(key, value);
      return;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      (globalThis as any).localStorage.setItem(key, value);
    }
  } catch {
    // Kept in memoryStore fallback
  }
}

export async function loadPersistedBookmarks(): Promise<{
  remindedIds: (string | number)[];
  cachedEvents: Record<string, EventItem>;
}> {
  try {
    const [rawIds, rawEvents] = await Promise.all([
      storageGetItem(REMINDED_IDS_STORAGE_KEY),
      storageGetItem(BOOKMARKED_EVENTS_STORAGE_KEY),
    ]);
    const remindedIds = rawIds ? JSON.parse(rawIds) : [];
    const cachedEvents = rawEvents ? JSON.parse(rawEvents) : {};
    return {
      remindedIds: Array.isArray(remindedIds) ? remindedIds : [],
      cachedEvents: cachedEvents && typeof cachedEvents === 'object' ? cachedEvents : {},
    };
  } catch {
    return { remindedIds: [], cachedEvents: {} };
  }
}

export async function savePersistedBookmarks(
  remindedIds: (string | number)[],
  cachedEvents: Record<string, EventItem>
): Promise<void> {
  await Promise.all([
    storageSetItem(REMINDED_IDS_STORAGE_KEY, JSON.stringify(remindedIds)),
    storageSetItem(BOOKMARKED_EVENTS_STORAGE_KEY, JSON.stringify(cachedEvents)),
  ]);
}

/**
 * Computes the reminder notification Date for an event:
 * - If `start_time` is valid, schedules 4 hours prior to the event's start date/time.
 * - If `start_time` is missing or unparseable, schedules for 4:00 PM (16:00) on `event_date`.
 */
export function computeFourHourReminderDate(
  eventDateStr?: string | null,
  startTimeStr?: string | null
): Date | null {
  if (!eventDateStr) return null;
  const datePart = String(eventDateStr).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;

  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return null;

  let parsedHour: number | null = null;
  let parsedMinute = 0;

  if (startTimeStr && String(startTimeStr).trim()) {
    const raw = String(startTimeStr).trim();
    const amPmMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*([AP]M)$/i);
    if (amPmMatch) {
      let hr = parseInt(amPmMatch[1], 10);
      const min = amPmMatch[2] ? parseInt(amPmMatch[2], 10) : 0;
      const meridiem = amPmMatch[3].toUpperCase();
      if (meridiem === 'PM' && hr < 12) hr += 12;
      if (meridiem === 'AM' && hr === 12) hr = 0;
      parsedHour = hr;
      parsedMinute = min;
    } else {
      const parts = raw.slice(0, 5).split(':');
      if (parts.length === 2) {
        const hr = parseInt(parts[0], 10);
        const min = parseInt(parts[1], 10);
        if (!Number.isNaN(hr) && !Number.isNaN(min)) {
          parsedHour = hr;
          parsedMinute = min;
        }
      }
    }
  }

  if (parsedHour !== null) {
    const eventStart = new Date(year, month - 1, day, parsedHour, parsedMinute, 0, 0);
    // 4 hours prior to event start time
    return new Date(eventStart.getTime() - 4 * 60 * 60 * 1000);
  }

  // Fallback when event has no valid start_time: 4:00 PM on event_date
  return new Date(year, month - 1, day, 16, 0, 0, 0);
}

export async function scheduleEventReminderNotification(
  event: EventItem
): Promise<{ scheduled: boolean; triggerDate: Date | null }> {
  const triggerDate = computeFourHourReminderDate(event.event_date, event.start_time);
  if (!triggerDate) {
    return { scheduled: false, triggerDate: null };
  }

  const Notifications = getExpoNotificationsModule();
  if (!Notifications) {
    return { scheduled: false, triggerDate };
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return { scheduled: false, triggerDate };
    }

    // Only schedule if the trigger time is in the future
    if (triggerDate.getTime() <= Date.now()) {
      return { scheduled: false, triggerDate };
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚡ Tonight on Astra: ${event.title || 'Upcoming Signal'}`,
        body: `${event.venue_name || 'Minneapolis'} • Starting in 4 hours. Tap to view signal details.`,
        data: { eventId: event.id, postUrl: event.post_url },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes?.DATE ?? 'date',
        date: triggerDate,
      },
    });

    if (notificationId) {
      const rawMap = await storageGetItem(NOTIFICATION_IDS_STORAGE_KEY);
      const map: Record<string, string> = rawMap ? JSON.parse(rawMap) : {};
      map[String(event.id)] = notificationId;
      await storageSetItem(NOTIFICATION_IDS_STORAGE_KEY, JSON.stringify(map));
    }

    return { scheduled: true, triggerDate };
  } catch {
    return { scheduled: false, triggerDate };
  }
}

export async function cancelEventReminderNotification(eventId: string | number): Promise<void> {
  const Notifications = getExpoNotificationsModule();
  try {
    const rawMap = await storageGetItem(NOTIFICATION_IDS_STORAGE_KEY);
    if (!rawMap) return;
    const map: Record<string, string> = JSON.parse(rawMap);
    const notifId = map[String(eventId)];
    if (notifId && Notifications && typeof Notifications.cancelScheduledNotificationAsync === 'function') {
      await Notifications.cancelScheduledNotificationAsync(notifId);
    }
    delete map[String(eventId)];
    await storageSetItem(NOTIFICATION_IDS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore cancellation errors
  }
}

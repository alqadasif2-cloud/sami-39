import fs from 'fs';
import path from 'path';
import { getChannelById, projectId, databaseId } from './db.ts';

export interface DeviceTokenRecord {
  id: string;
  token: string;
  userId: number;
  username: string;
  deviceId?: string;
  platform?: string;
  deviceModel?: string;
  updatedAt: number;
  createdAt: number;
}

export interface StoredNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  senderId: number;
  senderName: string;
  senderRole?: string;
  channelId?: string | null;
  partnerId?: number | null;
  chatType: 'channel' | 'private';
  messageId: string;
  targetUserIds: number[];
  timestamp: number;
  priority: 'high' | 'normal';
  fcmStatus?: string;
}

const FCM_STORE_FILE = path.resolve('data/fcm_tokens.json');
const NOTIF_STORE_FILE = path.resolve('data/notifications_history.json');

// Memory cache of recently dispatched message IDs to prevent duplicate alerts
const recentlyDispatchedMsgIds = new Set<string>();

function loadFcmTokens(): Record<string, DeviceTokenRecord> {
  try {
    if (fs.existsSync(FCM_STORE_FILE)) {
      return JSON.parse(fs.readFileSync(FCM_STORE_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('[FCM] Error reading tokens:', err);
  }
  return {};
}

function saveFcmTokens(tokens: Record<string, DeviceTokenRecord>) {
  try {
    const dir = path.dirname(FCM_STORE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FCM_STORE_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
  } catch (err) {
    console.error('[FCM] Error saving tokens:', err);
  }
}

function appendNotificationHistory(notif: StoredNotification) {
  try {
    let list: StoredNotification[] = [];
    if (fs.existsSync(NOTIF_STORE_FILE)) {
      list = JSON.parse(fs.readFileSync(NOTIF_STORE_FILE, 'utf-8'));
    }
    list.push(notif);
    // Keep last 300 notifications
    if (list.length > 300) {
      list = list.slice(-300);
    }
    const dir = path.dirname(NOTIF_STORE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(NOTIF_STORE_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[FCM] Notice saving notification history:', err);
  }
}

export function hasServerFcmCredentials(): boolean {
  if (process.env.FCM_SERVER_KEY || process.env.FIREBASE_MESSAGING_KEY || process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return true;
  }
  const localCandidates = [
    path.resolve('data/service_account.json'),
    path.resolve('data/firebase_service_account.json'),
    path.resolve('service_account.json'),
  ];
  return localCandidates.some((p) => fs.existsSync(p));
}

export async function registerDeviceToken(params: {
  token: string;
  userId: number;
  username: string;
  deviceId?: string;
  platform?: string;
  deviceModel?: string;
}): Promise<DeviceTokenRecord> {
  const tokens = loadFcmTokens();
  const safeDev = String(params.deviceId || 'dev').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'dev';
  const id = `fcm_tok_${params.userId}_${safeDev}`;
  const now = Date.now();

  // If another user previously registered on the exact same physical device, unbind it
  if (params.deviceId) {
    for (const [k, v] of Object.entries(tokens)) {
      if (v.deviceId === params.deviceId && v.userId !== params.userId) {
        delete tokens[k];
      }
    }
  }

  const record: DeviceTokenRecord = {
    id,
    token: params.token.trim(),
    userId: params.userId,
    username: params.username,
    deviceId: params.deviceId,
    platform: params.platform || 'android',
    deviceModel: params.deviceModel,
    updatedAt: now,
    createdAt: tokens[id]?.createdAt || now,
  };

  tokens[id] = record;
  saveFcmTokens(tokens);
  console.log(`[FCM] Registered token for user=${params.userId} device=${safeDev}`);
  return record;
}

export async function unregisterDeviceToken(userId: number, token?: string, deviceId?: string): Promise<void> {
  const tokens = loadFcmTokens();
  let changed = false;

  for (const [key, item] of Object.entries(tokens)) {
    if (item.userId === userId) {
      if ((token && item.token === token) || (deviceId && item.deviceId === deviceId) || (!token && !deviceId)) {
        delete tokens[key];
        changed = true;
      }
    }
  }

  if (changed) {
    saveFcmTokens(tokens);
    console.log(`[FCM] Unregistered token for user=${userId}`);
  }
}

async function getGoogleOAuthAccessToken(): Promise<string | null> {
  try {
    const { GoogleAuth } = await import('google-auth-library');
    let credentials: any = undefined;

    // 1. Check environment variables
    const rawEnv =
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      process.env.GCP_SERVICE_ACCOUNT_KEY ||
      process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawEnv && rawEnv.trim().length > 0) {
      try {
        const text = rawEnv.trim().startsWith('{') ? rawEnv.trim() : Buffer.from(rawEnv.trim(), 'base64').toString('utf-8');
        credentials = JSON.parse(text);
      } catch (err) {
        console.warn('[FCM] Error parsing service account JSON from environment:', err);
      }
    }

    // 2. Check local key files in data directory
    if (!credentials) {
      const candidates = [
        path.resolve('data/service_account.json'),
        path.resolve('data/firebase_service_account.json'),
        path.resolve('service_account.json'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          try {
            credentials = JSON.parse(fs.readFileSync(p, 'utf-8'));
            break;
          } catch {}
        }
      }
    }

    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
      ...(credentials ? { credentials } : {}),
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token || null;
  } catch (err: any) {
    return null;
  }
}

async function syncNotificationToFirestoreRest(notif: StoredNotification): Promise<void> {
  try {
    const dbSegment = encodeURIComponent(databaseId || '(default)');
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${dbSegment}/documents/community_notifications/${encodeURIComponent(notif.id)}`;

    const fields: Record<string, any> = {
      id: { stringValue: notif.id },
      type: { stringValue: notif.type },
      title: { stringValue: notif.title },
      body: { stringValue: notif.body },
      senderId: { integerValue: String(notif.senderId) },
      senderName: { stringValue: notif.senderName },
      chatType: { stringValue: notif.chatType },
      messageId: { stringValue: notif.messageId },
      timestamp: { integerValue: String(notif.timestamp) },
      priority: { stringValue: notif.priority },
      fcmStatus: { stringValue: notif.fcmStatus || 'queued' },
      targetUserIds: {
        arrayValue: {
          values: notif.targetUserIds.map((uid) => ({ integerValue: String(uid) })),
        },
      },
    };

    if (notif.channelId) fields.channelId = { stringValue: notif.channelId };
    if (notif.partnerId) fields.partnerId = { integerValue: String(notif.partnerId) };
    if (notif.senderRole) fields.senderRole = { stringValue: notif.senderRole };

    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
      signal: AbortSignal.timeout(6000),
    });
  } catch (_err) {
    // Graceful offline fallback
  }
}

async function dispatchFcmV1Message(params: {
  accessToken: string;
  deviceToken: string;
  title: string;
  body: string;
  chatType: 'channel' | 'private';
  channelId?: string;
  partnerId?: number;
  messageId: string;
  senderId: number;
  senderName: string;
  recipientUserId: number;
}): Promise<boolean> {
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
  const channelNotificationId = params.chatType === 'private' ? 'sami_private_messages_v2' : 'sami_channel_messages_v2';

  const payload = {
    message: {
      token: params.deviceToken,
      notification: {
        title: params.title,
        body: params.body,
      },
      data: {
        title: params.title,
        body: params.body,
        chatType: params.chatType,
        channelId: params.channelId || '',
        partnerId: params.partnerId ? String(params.partnerId) : '',
        messageId: params.messageId,
        senderId: String(params.senderId),
        senderName: params.senderName,
        recipientUserId: String(params.recipientUserId),
      },
      android: {
        priority: 'HIGH' as const,
        notification: {
          channel_id: channelNotificationId,
          notification_priority: 'PRIORITY_HIGH' as const,
          default_sound: true,
          default_vibrate_timings: true,
          tag: params.messageId.slice(0, 64),
        },
      },
    },
  };

  try {
    const resp = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      return true;
    } else {
      const errText = await resp.text();
      console.warn(`[FCM HTTP v1] Notice sending to token (${params.deviceToken.slice(0, 10)}...): status ${resp.status} - ${errText.slice(0, 150)}`);
      return false;
    }
  } catch (err: any) {
    console.warn(`[FCM HTTP v1] Request error:`, err?.message || err);
    return false;
  }
}

async function dispatchLegacyFcmMessage(params: {
  serverKey: string;
  deviceToken: string;
  title: string;
  body: string;
  chatType: 'channel' | 'private';
  channelId?: string;
  partnerId?: number;
  messageId: string;
  senderId: number;
  senderName: string;
  recipientUserId: number;
}): Promise<boolean> {
  const legacyUrl = 'https://fcm.googleapis.com/fcm/send';
  const channelNotificationId = params.chatType === 'private' ? 'sami_private_messages_v2' : 'sami_channel_messages_v2';

  const payload = {
    to: params.deviceToken,
    priority: 'high',
    notification: {
      title: params.title,
      body: params.body,
      sound: 'default',
      android_channel_id: channelNotificationId,
      tag: params.messageId.slice(0, 64),
      click_action: 'OPEN_SAMI_CHAT',
    },
    data: {
      title: params.title,
      body: params.body,
      chatType: params.chatType,
      channelId: params.channelId || '',
      partnerId: params.partnerId ? String(params.partnerId) : '',
      messageId: params.messageId,
      senderId: String(params.senderId),
      senderName: params.senderName,
      recipientUserId: String(params.recipientUserId),
      click_action: 'OPEN_SAMI_CHAT',
    },
  };

  try {
    const resp = await fetch(legacyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `key=${params.serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function sendNotificationToUsers(
  recipientIds: number[],
  payload: {
    title?: string;
    body?: string;
    chatType?: 'channel' | 'private';
    channelId?: string;
    partnerId?: number;
    messageId?: string;
    senderId?: number;
    senderName?: string;
    data?: Record<string, string>;
  }
): Promise<{ success: boolean; sentCount: number }> {
  const tokens = loadFcmTokens();
  const cleanRecipientIds = Array.from(new Set(recipientIds)).filter((id) => id > 0 && id !== (payload.senderId || 0));

  if (cleanRecipientIds.length === 0) {
    return { success: true, sentCount: 0 };
  }

  const title = payload.title || 'رسالة جديدة - Sami';
  const body = payload.body || 'لديك رسالة جديدة في تطبيق Sami';
  const chatType = payload.chatType || 'channel';
  const messageId = payload.messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const senderId = payload.senderId || 0;
  const senderName = payload.senderName || 'Sami';
  const now = Date.now();

  // 1. Record structured notification in local audit history
  const notifDocId = `notif_${now}_${senderId}_${Math.random().toString(36).substring(2, 7)}`;
  const notifRecord: StoredNotification = {
    id: notifDocId,
    type: chatType === 'private' ? 'private_message' : 'channel_important',
    title,
    body,
    senderId,
    senderName,
    channelId: payload.channelId || null,
    partnerId: payload.partnerId || null,
    chatType,
    messageId,
    targetUserIds: cleanRecipientIds,
    timestamp: now,
    priority: 'high',
    fcmStatus: 'queued',
  };
  appendNotificationHistory(notifRecord);

  // Dual-publish notification record to Firestore REST API (community_notifications)
  syncNotificationToFirestoreRest(notifRecord).catch((err) => {
    console.warn('[FCM] syncNotificationToFirestoreRest notice:', err?.message || err);
  });

  // 2. Map recipient users to their registered active device tokens
  const targetTokenRecords: Array<{ token: string; userId: number }> = [];
  for (const item of Object.values(tokens)) {
    if (cleanRecipientIds.includes(item.userId) && item.token && item.userId !== senderId) {
      if (!targetTokenRecords.some((r) => r.token === item.token)) {
        targetTokenRecords.push({ token: item.token, userId: item.userId });
      }
    }
  }

  if (targetTokenRecords.length === 0) {
    console.log(`[FCM Push] Notification recorded for ${cleanRecipientIds.length} users (no active FCM tokens registered): ${title}`);
    return { success: true, sentCount: 0 };
  }

  console.log(`[FCM Push] Dispatching push to ${targetTokenRecords.length} devices for ${cleanRecipientIds.length} users: "${title}"`);

  // 3. Dispatch to devices via FCM HTTP v1 or legacy API
  let sentSuccessful = 0;
  const accessToken = await getGoogleOAuthAccessToken();
  const legacyKey = process.env.FCM_SERVER_KEY || process.env.FIREBASE_MESSAGING_KEY;

  for (const { token, userId } of targetTokenRecords) {
    let delivered = false;
    if (accessToken) {
      delivered = await dispatchFcmV1Message({
        accessToken,
        deviceToken: token,
        title,
        body,
        chatType,
        channelId: payload.channelId,
        partnerId: payload.partnerId,
        messageId,
        senderId,
        senderName,
        recipientUserId: userId,
      });
    }

    if (!delivered && legacyKey) {
      delivered = await dispatchLegacyFcmMessage({
        serverKey: legacyKey,
        deviceToken: token,
        title,
        body,
        chatType,
        channelId: payload.channelId,
        partnerId: payload.partnerId,
        messageId,
        senderId,
        senderName,
        recipientUserId: userId,
      });
    }

    if (delivered) {
      sentSuccessful++;
    }
  }

  console.log(`[FCM Push] Completed dispatch: ${sentSuccessful}/${targetTokenRecords.length} devices delivered`);
  return { success: true, sentCount: sentSuccessful };
}

export async function dispatchAuthorizedChatPush(params: {
  senderId: number;
  senderName?: string;
  senderRole?: string;
  chatType: 'channel' | 'private';
  channelId?: string;
  receiverId?: number;
  partnerId?: number;
  messageId: string;
  snippet: string;
}): Promise<{ sentCount: number; recipientIds?: number[]; error?: string }> {
  try {
    // Deduplication check: prevent pushing the same message multiple times
    if (params.messageId) {
      if (recentlyDispatchedMsgIds.has(params.messageId)) {
        return { sentCount: 0, recipientIds: [] };
      }
      recentlyDispatchedMsgIds.add(params.messageId);
      if (recentlyDispatchedMsgIds.size > 200) {
        const oldest = recentlyDispatchedMsgIds.values().next().value;
        if (oldest) recentlyDispatchedMsgIds.delete(oldest);
      }
    }

    let recipientIds: number[] = [];

    if (params.chatType === 'private') {
      const targetUid = params.receiverId || params.partnerId;
      if (targetUid && targetUid > 0 && targetUid !== params.senderId) {
        recipientIds.push(targetUid);
      }
    } else {
      // Channel message: identify authorized channel recipients
      if (params.channelId) {
        const channel = await getChannelById(params.channelId);
        if (channel) {
          const members = channel.allowedMemberIds || channel.memberIds || [];
          for (const mId of members) {
            const numId = Number(mId);
            if (numId > 0 && numId !== params.senderId && !recipientIds.includes(numId)) {
              recipientIds.push(numId);
            }
          }
        }
      }

      // If channel is public or has tokens in store, include all non-sender device owners
      if (recipientIds.length === 0) {
        const tokens = loadFcmTokens();
        for (const item of Object.values(tokens)) {
          if (item.userId !== params.senderId && !recipientIds.includes(item.userId)) {
            recipientIds.push(item.userId);
          }
        }
      }
    }

    // Filter out sender and invalid IDs
    recipientIds = recipientIds.filter((id) => id > 0 && id !== params.senderId);

    if (recipientIds.length === 0) {
      return { sentCount: 0, recipientIds: [] };
    }

    const senderDisplay = params.senderName || 'متداول';
    let title: string;
    if (params.chatType === 'private') {
      title = params.senderId === 1 ? '👑 رسالة خاصة من القائد Sami' : `💬 رسالة خاصة من ${senderDisplay}`;
    } else {
      let chanName = 'القناة';
      if (params.channelId) {
        const c = await getChannelById(params.channelId);
        if (c?.name) chanName = c.name;
      }
      const rolePrefix = params.senderRole === 'owner' || params.senderId === 1 ? '👑 ' : params.senderRole === 'moderator' ? '🛡️ ' : '';
      title = `${rolePrefix}${senderDisplay} • ${chanName}`;
    }

    const pushRes = await sendNotificationToUsers(recipientIds, {
      title,
      body: params.snippet || 'رسالة جديدة',
      chatType: params.chatType,
      channelId: params.channelId,
      partnerId: params.chatType === 'private' ? params.senderId : undefined,
      messageId: params.messageId,
      senderId: params.senderId,
      senderName: senderDisplay,
      data: {
        chatType: params.chatType,
        channelId: params.channelId || '',
        partnerId: params.chatType === 'private' ? String(params.senderId) : '',
        messageId: params.messageId,
        senderId: String(params.senderId),
        senderName: senderDisplay,
      },
    });

    return { sentCount: pushRes.sentCount, recipientIds };
  } catch (err: any) {
    console.error('[FCM] Error in dispatchAuthorizedChatPush:', err);
    return { sentCount: 0, error: err?.message || String(err) };
  }
}

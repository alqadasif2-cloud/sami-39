import React, { useState, useEffect, useRef, useCallback } from './samiReactShim.ts';
import JSZip from 'jszip';
import { SamiChannelMembersModal } from './samiChannelMembersModal.tsx';
import {
  SAMI_EMOJIS,
  SamiEmojiBar,
  SamiMessageReactions,
  SamiPinButton,
  SamiPinnedBanner,
  toggleMessageReaction,
  toggleMessagePin,
} from './samiMessengerExtensions.tsx';
import { SamiAdminFirebaseUpdatePanel } from './samiAdminFirebaseUpdatePanel.tsx';

// Storage Quota Shield: automatically handles QuotaExceededError in localStorage
if (typeof window !== 'undefined' && window.Storage) {
  try {
    const originalSetItem = Storage.prototype.setItem;
    const originalGetItem = Storage.prototype.getItem;
    const originalRemoveItem = Storage.prototype.removeItem;
    
    const memStore: Record<string, string> = ((window as any).__samiMemStore = (window as any).__samiMemStore || {});

    const pruneVolatileStorage = (storage: Storage) => {
      try {
        const activeUid = (function() {
          try {
            return storage.getItem('sami_active_uid') || null;
          } catch { return null; }
        })();

        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (!k) continue;
          if (k.startsWith('sami_cached_channel_msgs_') || k.startsWith('sami_cached_pm_') || k.startsWith('sami_cached_channels_')) {
            keysToRemove.push(k);
          } else if (activeUid && k.startsWith('sami_u_') && !k.startsWith(`sami_u_${activeUid}_`)) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          try { storage.removeItem(k); } catch {}
        }
      } catch {}
    };

    Storage.prototype.setItem = function(key: string, value: string) {
      try {
        originalSetItem.call(this, key, value);
        delete memStore[key];
      } catch (err: any) {
        if (err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014 || (err.message && err.message.includes('quota')))) {
          pruneVolatileStorage(this);
          try {
            originalSetItem.call(this, key, value);
            delete memStore[key];
            return;
          } catch (retryErr) {
            memStore[key] = String(value);
            return;
          }
        }
        throw err;
      }
    };

    Storage.prototype.getItem = function(key: string) {
      try {
        const val = originalGetItem.call(this, key);
        if (val !== null) return val;
      } catch {}
      if (key in memStore) {
        return memStore[key];
      }
      return null;
    };

    Storage.prototype.removeItem = function(key: string) {
      delete memStore[key];
      try {
        return originalRemoveItem.call(this, key);
      } catch {}
    };
  } catch (e) {
    console.warn('Could not initialize Storage quota shield:', e);
  }
}

/**
 * Sami End-to-End Cloud In-App Update System (Client UI & Verification Engine)
 * - Admin Panel (`SamiAdminUpdatePanel`): APK File Picker, Local+Server Binary Manifest & X.509 Signing Cert Inspector,
 *   GitHub Releases Status, Real XHR Upload Progress (0%..100%) + Cancel + Retry, Release History, Pause/Resume, Rollback.
 * - User Update Modal (`SamiUserUpdateModal`): Black & Gold Sami Theme, Native Android `SamiBridge` + Web Resumable Range
 *   Streaming, 8-Point Pre-Install Integrity & Certificate Verification, and Official Android System PackageInstaller Trigger.
 */

export const SAMI_EXPECTED_APP_ID = 'com.sami.tradingchallengetracker';
export const SAMI_FALLBACK_VERSION_CODE = 16;
export const SAMI_FALLBACK_VERSION_NAME = '1.3.2';

export const SHARED_FIRESTORE_LATEST_DOC_URL =
  'https://firestore.googleapis.com/v1/projects/majestic-interface-ksmzh/databases/ai-studio-c1d1b606-9578-42a6-b7b2-17faaec47f72/documents/app_updates/latest';

export interface CloudAppUpdateConfig {
  id?: string;
  updateId?: string;
  title?: string;
  versionName: string;
  versionCode: number;
  description: string;
  fileSize?: number;
  fileName?: string;
  applicationId?: string;
  storagePath?: string;
  storageSource?: 'firebase_storage' | 'github_releases' | 'external_url' | 'legacy';
  deliveryMethod?: 'firebase_storage' | 'github_releases' | 'external_url';
  externalDownloadUrl?: string;
  githubOwner?: string;
  githubRepo?: string;
  githubReleaseId?: number;
  releaseTag?: string;
  githubAssetId?: number;
  isRepoPrivate?: boolean;
  downloadUrl: string;
  secureDownloadPath?: string;
  sha256?: string;
  signingCertSha256?: string;
  uploadedAt?: number;
  publishedAt?: number;
  updatedAt?: number;
  status?: 'draft' | 'published' | 'paused';
  isMandatory: boolean;
  minSupportedVersionCode?: number;
  publishedBy?: string;
  isActive: boolean;
  isHidden?: boolean;
  isEligibleForDistribution?: boolean;
  distributionStatus?: 'enabled' | 'disabled';
  globalDistributionEnabled?: boolean;
  configuredGithubOwner?: string;
  configuredGithubRepo?: string;
  configuredSettingsUpdatedAt?: number;
  configuredSettingsUpdatedBy?: string;
  configuredApiServerUrl?: string;
}

export interface InstalledAppInfo {
  applicationId: string;
  versionName: string;
  versionCode: number;
  signingCertSha256: string;
  canInstallPackages: boolean;
  isAndroidNative: boolean;
}

export interface ClientApkInspection {
  valid: boolean;
  fileName: string;
  fileSize: number;
  sha256: string;
  applicationId: string;
  versionName: string;
  versionCode: number;
  minSdkVersion?: number;
  targetSdkVersion?: number;
  hasClassesDex: boolean;
  signingCertificate: {
    sha256Fingerprint: string;
    sha256Hex: string;
    subject: string;
    scheme: string;
  } | null;
  signatureMatchesOriginal: boolean;
  applicationIdMatchesSami: boolean;
  isHigherThanPublished: boolean;
  publishedVersionCode: number;
  installedBaselineVersionCode: number;
  canPublish: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// ENVIRONMENT, PRODUCTION HTTPS SERVER URL & AUTH HELPERS
// (Strictly rejects localhost & Google AI Studio preview URLs!)
// ============================================================================

export function isAndroidLocalAssetOrigin(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'appassets.androidplatform.net' || window.location.protocol === 'file:')
    );
  } catch {
    return false;
  }
}

export function sanitizeProductionServerUrl(rawUrl: string | undefined | null): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed || trimmed === 'MY_APP_URL') return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return '';
    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === 'appassets.androidplatform.net' ||
      host.startsWith('ais-dev-') ||
      host.startsWith('ais-pre-') ||
      host.endsWith('.usercontent.goog')
    ) {
      return '';
    }
    return parsed.origin.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function persistProductionServerUrlLocally(rawUrl: string | undefined | null): string {
  const valid = sanitizeProductionServerUrl(rawUrl);
  if (!valid) return '';
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sami_push_server_url', valid);
    }
    if (typeof window !== 'undefined') {
      const w = window as any;
      w.__samiConfiguredServerBase = valid;
      if (w.SamiBridge && typeof w.SamiBridge.setRemoteServerUrl === 'function') {
        w.SamiBridge.setRemoteServerUrl(valid);
      }
    }
  } catch {}
  return valid;
}

export function getSamiServerBaseUrl(): string {
  try {
    if (!isAndroidLocalAssetOrigin()) {
      // Running directly on web server (deployed Cloud Run HTTPS or active host): use relative same-origin routes
      return '';
    }
    if (typeof window !== 'undefined') {
      const w = window as any;
      const winCached = sanitizeProductionServerUrl(w.__samiConfiguredServerBase);
      if (winCached) return winCached;
    }
    if (typeof localStorage !== 'undefined') {
      const rawStored = localStorage.getItem('sami_push_server_url');
      if (rawStored) {
        const cleanStored = sanitizeProductionServerUrl(rawStored);
        if (cleanStored) {
          return cleanStored;
        }
        // Purge stale preview (`ais-pre-*` / `ais-dev-*`) or `localhost` URLs immediately
        localStorage.removeItem('sami_push_server_url');
      }
    }
    return '';
  } catch {
    return '';
  }
}

interface CloudFirestoreDirectSnapshot {
  configuredGithubOwner: string;
  configuredGithubRepo: string;
  configuredApiServerUrl: string;
  configuredSettingsUpdatedAt: number | null;
  latestUpdate: CloudAppUpdateConfig | null;
}

export async function discoverCloudStateFromFirestore(parentSignal?: AbortSignal): Promise<CloudFirestoreDirectSnapshot | null> {
  const ctrl = new AbortController();
  const onParentAbort = () => ctrl.abort();
  if (parentSignal) {
    if (parentSignal.aborted) return null;
    parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }
  const timer = setTimeout(() => ctrl.abort(), 10_000);

  try {
    const res = await fetch(SHARED_FIRESTORE_LATEST_DOC_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json: any = await res.json().catch(() => null);
    const f = json?.fields;
    if (!f || typeof f !== 'object') return null;

    const readVal = (v: any): any => {
      if (!v || typeof v !== 'object') return undefined;
      if ('stringValue' in v) return v.stringValue;
      if ('booleanValue' in v) return Boolean(v.booleanValue);
      if ('integerValue' in v) return Number(v.integerValue);
      if ('doubleValue' in v) return Number(v.doubleValue);
      return undefined;
    };

    const raw: Record<string, any> = {};
    for (const k of Object.keys(f)) {
      raw[k] = readVal(f[k]);
    }

    const discoveredServerUrl = persistProductionServerUrlLocally(raw.configuredApiServerUrl);
    const isActive = raw.status === 'published' ? raw.isActive !== false && raw.isHidden !== true : raw.isActive === true && raw.isHidden !== true;

    const latestUpdate: CloudAppUpdateConfig = {
      id: String(raw.id || 'latest'),
      versionName: String(raw.versionName || SAMI_FALLBACK_VERSION_NAME),
      versionCode: Number(raw.versionCode) || SAMI_FALLBACK_VERSION_CODE,
      description: String(raw.description || ''),
      fileSize: raw.fileSize ? Number(raw.fileSize) : undefined,
      fileName: raw.fileName ? String(raw.fileName) : undefined,
      applicationId: raw.applicationId ? String(raw.applicationId) : SAMI_EXPECTED_APP_ID,
      storagePath: raw.storagePath ? String(raw.storagePath) : undefined,
      storageSource:
        raw.storageSource === 'firebase_storage' || Boolean(raw.storagePath)
          ? 'firebase_storage'
          : raw.storageSource === 'github_releases' || Boolean(raw.githubReleaseId) || Boolean(raw.githubAssetId)
            ? 'github_releases'
            : 'legacy',
      githubOwner: raw.githubOwner ? String(raw.githubOwner) : undefined,
      githubRepo: raw.githubRepo ? String(raw.githubRepo) : undefined,
      githubReleaseId: raw.githubReleaseId ? Number(raw.githubReleaseId) : undefined,
      releaseTag: raw.releaseTag ? String(raw.releaseTag) : undefined,
      githubAssetId: raw.githubAssetId ? Number(raw.githubAssetId) : undefined,
      isRepoPrivate: typeof raw.isRepoPrivate === 'boolean' ? raw.isRepoPrivate : undefined,
      downloadUrl: String(raw.downloadUrl || ''),
      secureDownloadPath: raw.secureDownloadPath ? String(raw.secureDownloadPath) : undefined,
      sha256: raw.sha256 ? String(raw.sha256) : undefined,
      signingCertSha256: raw.signingCertSha256 ? String(raw.signingCertSha256) : undefined,
      status: isActive ? 'published' : 'paused',
      isMandatory: Boolean(raw.isMandatory),
      isActive,
      isHidden: !isActive,
      configuredGithubOwner: raw.configuredGithubOwner ? String(raw.configuredGithubOwner).trim() : '',
      configuredGithubRepo: raw.configuredGithubRepo ? String(raw.configuredGithubRepo).trim() : '',
      configuredApiServerUrl: discoveredServerUrl,
    };

    return {
      configuredGithubOwner: String(raw.configuredGithubOwner || '').trim(),
      configuredGithubRepo: String(raw.configuredGithubRepo || '').trim(),
      configuredApiServerUrl: discoveredServerUrl,
      configuredSettingsUpdatedAt: raw.configuredSettingsUpdatedAt ? Number(raw.configuredSettingsUpdatedAt) : null,
      latestUpdate,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}

class CancelledRequestError extends Error {
  isCancelled = true;
  constructor() {
    super('تم إلغاء الطلب عند مغادرة الصفحة');
  }
}

export function translateNetworkOrHttpErrorAr(err: any, httpStatus?: number, serverErrorText?: string): string {
  const cleanServerErr = String(serverErrorText || '').trim();
  if (httpStatus === 401) {
    return cleanServerErr || 'انتهت جلسة تسجيل الدخول أو يلزم الدخول بحساب مالك التطبيق.';
  }
  if (httpStatus === 403) {
    return cleanServerErr || 'هذه العملية مخصصة حصرياً لمالك تطبيق Sami (Owner Only).';
  }
  if (httpStatus === 404) {
    return cleanServerErr || 'لم يتم العثور على مسار خدمة التحديثات على الخادم المتصل به.';
  }
  if (httpStatus && httpStatus >= 500) {
    return cleanServerErr || `واجه الخادم خطأً داخلياً مؤقتاً (HTTP ${httpStatus}). يرجى المحاولة مرة أخرى.`;
  }
  if (cleanServerErr) {
    return cleanServerErr;
  }

  const rawMsg = String(err?.message || err || '').trim();
  const lower = rawMsg.toLowerCase();
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('network request failed') ||
    lower.includes('fetch')
  ) {
    return 'تعذر الاتصال بخادم التحديثات المنشور عبر HTTPS. يرجى التحقق من اتصال الإنترنت وعنوان الخادم ثم الضغط على «إعادة المحاولة».';
  }
  if (err?.name === 'TimeoutError' || lower.includes('timeout') || lower.includes('timed out')) {
    return 'انتهت مهلة الاتصال بالخادم (15 ثانية). تحقق من استقرار الشبكة ثم اضغط «إعادة المحاولة».';
  }
  if (!rawMsg || /^[A-Za-z0-9_:\s.,()-]+$/.test(rawMsg)) {
    return 'تعذر إتمام الاتصال بالخادم حالياً. يرجى المحاولة مرة أخرى.';
  }
  return rawMsg;
}

export async function fetchJsonApi(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    timeoutMs?: number;
    parentSignal?: AbortSignal;
  } = {}
): Promise<{ status: number; ok: boolean; data: any }> {
  const { method = 'GET', headers = {}, body, timeoutMs = 15_000, parentSignal } = options;
  if (parentSignal?.aborted) {
    throw new CancelledRequestError();
  }

  const ctrl = new AbortController();
  let timedOut = false;
  const onParentAbort = () => ctrl.abort();
  if (parentSignal) {
    parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      body,
      cache: 'no-store',
      signal: ctrl.signal,
    });

    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      if (parentSignal?.aborted) throw new CancelledRequestError();
      throw new Error(
        'العنوان المتصل به لم يُرجع استجابة API صالحة (JSON). تأكد من الاتصال بالخادم الفعلي المنشور عبر HTTPS وليس عنوان معاينة.'
      );
    }

    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  } catch (err: any) {
    if (parentSignal?.aborted || err instanceof CancelledRequestError) {
      throw new CancelledRequestError();
    }
    if (timedOut) {
      const timeoutErr = new Error(
        'انتهت مهلة الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت ثم الضغط على «إعادة المحاولة».'
      );
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    }
    throw new Error(translateNetworkOrHttpErrorAr(err));
  } finally {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}

export function getAuthCredentials(): {
  token: string;
  encodedSession: string;
  headers: Record<string, string>;
} {
  let token = '';
  let rawSession = '';
  try {
    rawSession = localStorage.getItem('sami_auth_user_session') || '';
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (parsed && parsed.token) {
        token = String(parsed.token);
      }
    }
  } catch {}

  const encodedSession = rawSession ? encodeURIComponent(rawSession) : '';
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (encodedSession) headers['X-Sami-Session'] = encodedSession;
  return { token, encodedSession, headers };
}

export function getInstalledSamiAppInfo(): InstalledAppInfo {
  const w = typeof window !== 'undefined' ? (window as any) : {};
  try {
    if (w.SamiBridge && typeof w.SamiBridge.getInstalledAppInfo === 'function') {
      const raw = w.SamiBridge.getInstalledAppInfo();
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed && Number(parsed.versionCode) > 0) {
          w.__samiNativeAppInfo = parsed;
          return {
            applicationId: String(parsed.applicationId || SAMI_EXPECTED_APP_ID),
            versionName: String(parsed.versionName || SAMI_FALLBACK_VERSION_NAME),
            versionCode: Number(parsed.versionCode),
            signingCertSha256: String(parsed.signingCertSha256 || ''),
            canInstallPackages: Boolean(parsed.canInstallPackages),
            isAndroidNative: true,
          };
        }
      }
    }
    if (w.__samiNativeAppInfo && Number(w.__samiNativeAppInfo.versionCode) > 0) {
      const p = w.__samiNativeAppInfo;
      return {
        applicationId: String(p.applicationId || SAMI_EXPECTED_APP_ID),
        versionName: String(p.versionName || SAMI_FALLBACK_VERSION_NAME),
        versionCode: Number(p.versionCode),
        signingCertSha256: String(p.signingCertSha256 || ''),
        canInstallPackages: Boolean(p.canInstallPackages),
        isAndroidNative: true,
      };
    }
  } catch {}

  return {
    applicationId: SAMI_EXPECTED_APP_ID,
    versionName: SAMI_FALLBACK_VERSION_NAME,
    versionCode: SAMI_FALLBACK_VERSION_CODE,
    signingCertSha256: '',
    canInstallPackages: false,
    isAndroidNative: false,
  };
}

export function openInExternalBrowser(url: string): boolean {
  const clean = (url || '').trim();
  if (!clean.startsWith('https://') && !clean.startsWith('http://')) return false;

  const w = typeof window !== 'undefined' ? (window as any) : {};
  try {
    if (w.SamiBridge && typeof w.SamiBridge.openExternalBrowser === 'function') {
      const ok = w.SamiBridge.openExternalBrowser(clean);
      if (ok) return true;
    }
  } catch {}

  try {
    const win = window.open(clean, '_blank', 'noopener,noreferrer');
    if (win) return true;
  } catch {}

  try {
    const a = document.createElement('a');
    a.href = clean;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {}

  return false;
}

export function shouldShowCloudAppUpdate(config: CloudAppUpdateConfig | null | undefined): boolean {
  if (!config) return false;

  // Condition 1: Global update distribution must be enabled
  if (config.globalDistributionEnabled === false) return false;

  // Condition 2: Individual update distribution status must be enabled
  if (config.isActive !== true || config.isHidden === true) return false;
  if (config.distributionStatus === 'disabled') return false;
  if (config.status && config.status !== 'published') return false;

  // Condition 3: Must be published after new notification system feature was implemented
  // Critical: Historical updates (isEligibleForDistribution !== true) must NEVER show!
  if (config.isEligibleForDistribution !== true) return false;

  // Support delivery methods: Firebase Storage, External APK URL, and GitHub Releases
  const isFirebaseStorage =
    config.deliveryMethod === 'firebase_storage' ||
    config.storageSource === 'firebase_storage' ||
    Boolean(config.storagePath) ||
    (typeof config.downloadUrl === 'string' && (config.downloadUrl.includes('/download/v_') || config.downloadUrl.includes('firebasestorage.googleapis.com')));

  const isExternalUrl =
    config.deliveryMethod === 'external_url' ||
    config.storageSource === 'external_url' ||
    (typeof config.externalDownloadUrl === 'string' && config.externalDownloadUrl.trim().length > 0) ||
    (typeof config.downloadUrl === 'string' && config.downloadUrl.startsWith('https://') && !config.downloadUrl.includes('/releases/download/'));

  const isGitHubRelease =
    config.deliveryMethod === 'github_releases' ||
    config.storageSource === 'github_releases' ||
    Boolean(config.githubReleaseId) ||
    Boolean(config.githubAssetId) ||
    (typeof config.downloadUrl === 'string' && config.downloadUrl.includes('/releases/download/'));

  if (!isFirebaseStorage && !isExternalUrl && !isGitHubRelease) return false;

  const effectiveUrl = (config.externalDownloadUrl || config.downloadUrl || '').trim();
  if (isExternalUrl && (!effectiveUrl || !effectiveUrl.startsWith('https://'))) return false;

  // Condition 4: User's installed application version code must be strictly older than published versionCode
  const installed = getInstalledSamiAppInfo();
  return Number(config.versionCode) > Number(installed.versionCode);
}

// ============================================================================
// FORMATTING & BINARY CRYPTO/AXML UTILITIES
// ============================================================================

export function formatBytesAr(bytes: number | undefined | null): string {
  const b = Number(bytes || 0);
  if (!b || b <= 0) return '0.00 MB';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatSpeedAr(bytesPerSec: number | undefined | null): string {
  const s = Number(bytesPerSec || 0);
  if (!s || s <= 0) return '';
  if (s < 1024 * 1024) return `${(s / 1024).toFixed(0)} KB/s`;
  return `${(s / (1024 * 1024)).toFixed(2)} MB/s`;
}

function encodeUtf8Base64(text: string): string {
  try {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch {
    return '';
  }
}

export async function computeArrayBufferSha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
  const arr = new Uint8Array(hashBuf);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeFpHex(fp: string | undefined | null): string {
  return String(fp || '')
    .replace(/[^a-fA-F0-9]/g, '')
    .toLowerCase();
}

function formatColonFp(hex: string): string {
  const clean = normalizeFpHex(hex).toUpperCase();
  if (clean.length !== 64) return clean;
  return clean.match(/.{1,2}/g)!.join(':');
}

/**
 * Client-side binary AndroidManifest.xml (AXML) parser for instant local APK inspection
 * and pre-install verification on Web.
 */
export function parseBinaryManifestClient(u8: Uint8Array): {
  applicationId: string;
  versionCode: number;
  versionName: string;
} {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (u8.byteLength < 16 || dv.getUint16(0, true) !== 0x0003) {
    throw new Error('ملف AndroidManifest.xml داخل الحزمة ليس بصيغة Android Binary XML صالحة');
  }

  let offset = dv.getUint16(2, true);
  const strings: string[] = [];
  const resIds: number[] = [];
  let applicationId = '';
  let versionCode = 0;
  let versionCodeMajor = 0;
  let versionName = '';

  while (offset + 8 <= u8.byteLength) {
    const chunkType = dv.getUint16(offset, true);
    const headerSize = dv.getUint16(offset + 2, true);
    const chunkSize = dv.getUint32(offset + 4, true);
    if (chunkSize < 8 || offset + chunkSize > u8.byteLength) break;

    if (chunkType === 0x0001) {
      const stringCount = dv.getUint32(offset + 8, true);
      const flags = dv.getUint32(offset + 16, true);
      const stringsStart = dv.getUint32(offset + 20, true);
      const isUtf8 = (flags & (1 << 8)) !== 0;
      const offsetsBase = offset + headerSize;
      const poolDataBase = offset + stringsStart;

      for (let i = 0; i < stringCount; i++) {
        const strOff = poolDataBase + dv.getUint32(offsetsBase + i * 4, true);
        if (strOff >= offset + chunkSize) {
          strings.push('');
          continue;
        }
        if (isUtf8) {
          let p = strOff;
          p += (u8[p] & 0x80) !== 0 ? 2 : 1;
          let byteLen = u8[p];
          if ((byteLen & 0x80) !== 0) {
            byteLen = ((byteLen & 0x7f) << 8) | u8[p + 1];
            p += 2;
          } else {
            p += 1;
          }
          strings.push(new TextDecoder('utf-8').decode(u8.subarray(p, p + byteLen)));
        } else {
          let p = strOff;
          let charLen = dv.getUint16(p, true);
          if ((charLen & 0x8000) !== 0) {
            charLen = ((charLen & 0x7fff) << 16) | dv.getUint16(p + 2, true);
            p += 4;
          } else {
            p += 2;
          }
          strings.push(new TextDecoder('utf-16le').decode(u8.subarray(p, p + charLen * 2)));
        }
      }
    } else if (chunkType === 0x0180) {
      const count = Math.floor((chunkSize - headerSize) / 4);
      for (let i = 0; i < count; i++) {
        resIds.push(dv.getUint32(offset + headerSize + i * 4, true));
      }
    } else if (chunkType === 0x0102) {
      const nameIdx = dv.getInt32(offset + 20, true);
      const attrStart = dv.getUint16(offset + 24, true);
      const attrSize = dv.getUint16(offset + 26, true);
      const attrCount = dv.getUint16(offset + 28, true);
      const elemName = nameIdx >= 0 && nameIdx < strings.length ? strings[nameIdx] : '';

      if (elemName === 'manifest' && attrSize >= 20) {
        const attrBase = offset + 16 + attrStart;
        for (let i = 0; i < attrCount; i++) {
          const aOff = attrBase + i * attrSize;
          if (aOff + 20 > offset + chunkSize) break;
          const aNameIdx = dv.getInt32(aOff + 4, true);
          const rawValIdx = dv.getInt32(aOff + 8, true);
          const dataType = u8[aOff + 15];
          const dataVal = dv.getUint32(aOff + 16, true);
          const aName = aNameIdx >= 0 && aNameIdx < strings.length ? strings[aNameIdx] : '';
          const resId = aNameIdx >= 0 && aNameIdx < resIds.length ? resIds[aNameIdx] : 0;
          const strVal =
            dataType === 0x03 && dataVal < strings.length
              ? strings[dataVal]
              : rawValIdx >= 0 && rawValIdx < strings.length
                ? strings[rawValIdx]
                : '';

          if (aName === 'package' && strVal) {
            applicationId = strVal;
          } else if (resId === 0x0101021b || aName === 'versionCode') {
            versionCode = dataVal;
          } else if (resId === 0x01010576 || aName === 'versionCodeMajor') {
            versionCodeMajor = dataVal;
          } else if (resId === 0x0101021c || aName === 'versionName') {
            versionName = strVal || String(dataVal);
          }
        }
      }
    }

    offset += chunkSize;
  }

  const fullCode = versionCodeMajor > 0 ? versionCodeMajor * 0x100000000 + versionCode : versionCode;
  return { applicationId, versionCode: fullCode, versionName };
}

/**
 * Extracts X.509 certificate SHA-256 fingerprint from APK Signature Scheme v2/v3 block in browser.
 */
export async function extractSigningCertSha256Client(buffer: ArrayBuffer): Promise<string | null> {
  try {
    const u8 = new Uint8Array(buffer);
    const dv = new DataView(buffer);
    const minSearch = Math.max(0, u8.byteLength - 65557);
    let eocdOffset = -1;
    for (let i = u8.byteLength - 22; i >= minSearch; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset < 0) return null;
    const cdOffset = dv.getUint32(eocdOffset + 16, true);
    if (cdOffset < 32 || cdOffset > u8.byteLength) return null;

    const magic = new TextDecoder('ascii').decode(u8.subarray(cdOffset - 16, cdOffset));
    if (magic !== 'APK Sig Block 42') return null;

    const blockSizeFooter = Number(dv.getBigUint64(cdOffset - 24, true));
    const blockStart = cdOffset - blockSizeFooter - 8;
    if (blockStart < 0) return null;

    let pos = blockStart + 8;
    const pairsEnd = cdOffset - 24;
    while (pos + 12 <= pairsEnd) {
      const pairLen = Number(dv.getBigUint64(pos, true));
      if (pairLen < 4 || pos + 8 + pairLen > pairsEnd) break;
      const blockId = dv.getUint32(pos + 8, true);
      if (blockId === 0x7109871a || blockId === 0xf05368c0 || blockId === 0x1b93ad61) {
        const valOff = pos + 12;
        const firstSignerOff = valOff + 8;
        const signedDataOff = firstSignerOff + 4;
        const digestsLen = dv.getUint32(signedDataOff, true);
        const certsOff = signedDataOff + 4 + digestsLen;
        const firstCertLen = dv.getUint32(certsOff + 4, true);
        const certStart = certsOff + 8;
        if (firstCertLen > 0 && certStart + firstCertLen <= pos + 8 + pairLen) {
          const certSlice = u8.slice(certStart, certStart + firstCertLen);
          const hex = await computeArrayBufferSha256Hex(certSlice.buffer);
          return formatColonFp(hex);
        }
      }
      pos += 8 + pairLen;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// REUSABLE PROGRESS BAR (SVG — ZERO INLINE CSS STYLES)
// ============================================================================

export function GoldProgressBar({
  percent,
  variant = 'gold',
}: {
  percent: number;
  variant?: 'gold' | 'emerald' | 'rose';
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const fillClass =
    variant === 'emerald'
      ? 'fill-emerald-400'
      : variant === 'rose'
        ? 'fill-rose-500'
        : 'fill-amber-400';

  return (
    <div dir="ltr" className="w-full rounded-lg overflow-hidden bg-[#070a12] border border-slate-800 p-0.5">
      <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="w-full h-2.5 block rounded">
        <rect x="0" y="0" width="100" height="4" className="fill-slate-900" />
        {clamped > 0 && (
          <rect x="0" y="0" width={clamped} height="4" className={`${fillClass} transition-all duration-150`} />
        )}
      </svg>
    </div>
  );
}

// ============================================================================
// PART 1: USER IN-APP UPDATE MODAL (`SamiUserUpdateModal`)
// ============================================================================

interface WebPersistedUpdateState {
  phase: string;
  statusTextAr: string;
  errorDetailAr: string | null;
  targetVersionCode: number;
  targetVersionName: string;
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
  speedBytesPerSec: number;
  canInstall: boolean;
  canResume: boolean;
  verifiedSha256: string | null;
  verifiedSigningCertSha256: string | null;
}

// Module-level Web download store so closing & reopening the modal preserves active download progress & buffers!
const webDownloadMemoryStore: {
  versionCode: number;
  chunks: Uint8Array[];
  downloadedBytes: number;
  totalBytes: number;
  verifiedBlob: Blob | null;
  abortCtrl: AbortController | null;
  state: WebPersistedUpdateState;
  listeners: Set<(s: WebPersistedUpdateState) => void>;
} = {
  versionCode: 0,
  chunks: [],
  downloadedBytes: 0,
  totalBytes: 0,
  verifiedBlob: null,
  abortCtrl: null,
  state: {
    phase: 'idle',
    statusTextAr: '',
    errorDetailAr: null,
    targetVersionCode: 0,
    targetVersionName: '',
    downloadedBytes: 0,
    totalBytes: 0,
    percent: 0,
    speedBytesPerSec: 0,
    canInstall: false,
    canResume: false,
    verifiedSha256: null,
    verifiedSigningCertSha256: null,
  },
  listeners: new Set(),
};

function emitWebUpdateState(patch: Partial<WebPersistedUpdateState>) {
  webDownloadMemoryStore.state = {
    ...webDownloadMemoryStore.state,
    ...patch,
  };
  for (const fn of webDownloadMemoryStore.listeners) {
    try {
      fn(webDownloadMemoryStore.state);
    } catch {}
  }
}

function concatUint8Arrays(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

async function runWebResumableDownloadAndVerify(config: CloudAppUpdateConfig, isResume: boolean) {
  if (webDownloadMemoryStore.abortCtrl) {
    return;
  }

  if (webDownloadMemoryStore.versionCode !== config.versionCode) {
    webDownloadMemoryStore.versionCode = config.versionCode;
    webDownloadMemoryStore.chunks = [];
    webDownloadMemoryStore.downloadedBytes = 0;
    webDownloadMemoryStore.verifiedBlob = null;
  }

  const abortCtrl = new AbortController();
  webDownloadMemoryStore.abortCtrl = abortCtrl;
  const existingOffset = webDownloadMemoryStore.downloadedBytes;
  const expectedTotal = Number(config.fileSize || 0);

  emitWebUpdateState({
    phase: isResume && existingOffset > 0 ? 'resuming' : 'connecting',
    statusTextAr: isResume && existingOffset > 0 ? 'جارٍ استئناف التنزيل' : 'جارٍ الاتصال بالخادم',
    errorDetailAr: null,
    targetVersionCode: config.versionCode,
    targetVersionName: config.versionName,
    downloadedBytes: existingOffset,
    totalBytes: expectedTotal,
    percent: expectedTotal > 0 ? Math.min(99, Math.floor((existingOffset * 99) / expectedTotal)) : 0,
    speedBytesPerSec: 0,
    canInstall: false,
    canResume: false,
  });

  try {
    let serverBase = getSamiServerBaseUrl();
    if (isAndroidLocalAssetOrigin() && !serverBase) {
      const cloudSnap = await discoverCloudStateFromFirestore(abortCtrl.signal);
      if (cloudSnap?.configuredApiServerUrl) {
        serverBase = cloudSnap.configuredApiServerUrl;
      }
    }
    const proxyPath = config.secureDownloadPath || `/api/app-updates/download/v_${config.versionCode}`;
    const canUseDirectPublicUrl =
      isAndroidLocalAssetOrigin() &&
      !serverBase &&
      !config.isRepoPrivate &&
      typeof config.downloadUrl === 'string' &&
      (config.downloadUrl.startsWith('https://github.com/') ||
        config.downloadUrl.startsWith('https://firebasestorage.googleapis.com/') ||
        config.downloadUrl.startsWith('https://storage.googleapis.com/'));
    if (isAndroidLocalAssetOrigin() && !serverBase && !canUseDirectPublicUrl) {
      throw new Error('لم يتم تسجيل عنوان الخادم المنشور (HTTPS) لتنزيل التحديث حالياً.');
    }
    const proxyUrl = canUseDirectPublicUrl ? config.downloadUrl : `${serverBase}${proxyPath}`;
    const { headers: authHeaders } = getAuthCredentials();

    // Use server streaming proxy on Web (supports CORS + Range 206 + private & public GitHub Releases seamlessly)
    const reqHeaders: Record<string, string> = canUseDirectPublicUrl ? {} : { ...authHeaders };
    if (existingOffset > 0 && (expectedTotal <= 0 || existingOffset < expectedTotal)) {
      reqHeaders.Range = `bytes=${existingOffset}-`;
    }

    const res = await fetch(proxyUrl, {
      method: 'GET',
      headers: reqHeaders,
      signal: abortCtrl.signal,
    });

    if (!res.ok && res.status !== 206) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(translateNetworkOrHttpErrorAr(null, res.status, errBody?.error));
    }

    const isPartial = res.status === 206 && existingOffset > 0;
    if (!isPartial) {
      webDownloadMemoryStore.chunks = [];
      webDownloadMemoryStore.downloadedBytes = 0;
    }

    const contentLen = parseInt(res.headers.get('content-length') || '0', 10) || 0;
    const resolvedTotal =
      expectedTotal > 0
        ? expectedTotal
        : isPartial && contentLen > 0
          ? existingOffset + contentLen
          : contentLen;
    webDownloadMemoryStore.totalBytes = resolvedTotal;

    emitWebUpdateState({
      phase: 'starting',
      statusTextAr: 'جارٍ بدء التنزيل',
      totalBytes: resolvedTotal,
    });

    if (!res.body) {
      throw new Error('لم يُرجع الخادم دفق بيانات قابل للقراءة');
    }

    const reader = res.body.getReader();
    let windowStart = Date.now();
    let windowBytes = 0;
    let speed = 0;
    let lastUiTick = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        webDownloadMemoryStore.chunks.push(value);
        webDownloadMemoryStore.downloadedBytes += value.byteLength;
        windowBytes += value.byteLength;

        const now = Date.now();
        if (now - windowStart >= 500) {
          speed = Math.round((windowBytes * 1000) / (now - windowStart));
          windowStart = now;
          windowBytes = 0;
        }

        if (now - lastUiTick >= 120) {
          lastUiTick = now;
          const dl = webDownloadMemoryStore.downloadedBytes;
          const pct = resolvedTotal > 0 ? Math.min(99, Math.floor((dl * 99) / resolvedTotal)) : 0;
          emitWebUpdateState({
            phase: 'downloading',
            statusTextAr: 'جارٍ تنزيل التحديث',
            downloadedBytes: dl,
            totalBytes: resolvedTotal,
            percent: pct,
            speedBytesPerSec: speed,
          });
        }
      }
    }

    webDownloadMemoryStore.abortCtrl = null;

    // Mandatory 8-point verification before allowing install
    const fullBytes = concatUint8Arrays(
      webDownloadMemoryStore.chunks,
      webDownloadMemoryStore.downloadedBytes
    );

    emitWebUpdateState({
      phase: 'verifying',
      statusTextAr: 'اكتمل التنزيل — جارٍ التحقق من سلامة الملف وشهادة التوقيع...',
      downloadedBytes: fullBytes.byteLength,
      totalBytes: expectedTotal || fullBytes.byteLength,
      percent: 99,
      speedBytesPerSec: 0,
    });

    // Check 1: File size match
    if (expectedTotal > 0 && fullBytes.byteLength !== expectedTotal) {
      throw new Error(
        `حجم الملف المحمّل (${fullBytes.byteLength} بايت) لا يطابق الحجم الرسمي المعتمد (${expectedTotal} بايت)`
      );
    }

    // Check 2: Local SHA-256 calculation matches Firestore SHA-256
    const localSha256 = await computeArrayBufferSha256Hex(fullBytes.buffer as ArrayBuffer);
    if (config.sha256 && localSha256.toLowerCase() !== config.sha256.toLowerCase()) {
      webDownloadMemoryStore.chunks = [];
      webDownloadMemoryStore.downloadedBytes = 0;
      throw new Error('بصمة SHA-256 للملف المحمّل لا تطابق البصمة الرسمية المعتمدة؛ تم حذف الملف التالف.');
    }

    // Check 3, 4, 5: Valid readable APK archive + applicationId + versionCode > installed
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(fullBytes);
    } catch {
      webDownloadMemoryStore.chunks = [];
      webDownloadMemoryStore.downloadedBytes = 0;
      throw new Error('الملف المحمّل تالف ولا يمثل حزمة Android APK صالحة.');
    }

    const manifestFile = zip.file('AndroidManifest.xml');
    const dexFile = zip.file('classes.dex');
    if (!manifestFile || !dexFile) {
      webDownloadMemoryStore.chunks = [];
      webDownloadMemoryStore.downloadedBytes = 0;
      throw new Error('الحزمة المحمّلة تفتقر إلى ملفات تطبيق Android الأساسية؛ تم رفض التثبيت.');
    }

    const manifestU8 = await manifestFile.async('uint8array');
    const parsedManifest = parseBinaryManifestClient(manifestU8);
    if (parsedManifest.applicationId !== SAMI_EXPECTED_APP_ID) {
      webDownloadMemoryStore.chunks = [];
      webDownloadMemoryStore.downloadedBytes = 0;
      throw new Error(
        `معرّف الحزمة داخل الملف (${parsedManifest.applicationId}) لا يطابق تطبيق Sami (${SAMI_EXPECTED_APP_ID}).`
      );
    }

    const installed = getInstalledSamiAppInfo();
    if (parsedManifest.versionCode <= installed.versionCode) {
      webDownloadMemoryStore.chunks = [];
      webDownloadMemoryStore.downloadedBytes = 0;
      throw new Error(
        `كود الإصدار داخل الحزمة (${parsedManifest.versionCode}) ليس أحدث من النسخة المثبتة (${installed.versionCode}).`
      );
    }

    // Check 6, 7, 8: Extract X.509 signing certificate & verify match
    const certColon = await extractSigningCertSha256Client(fullBytes.buffer as ArrayBuffer);
    if (config.signingCertSha256 && certColon) {
      if (normalizeFpHex(certColon) !== normalizeFpHex(config.signingCertSha256)) {
        webDownloadMemoryStore.chunks = [];
        webDownloadMemoryStore.downloadedBytes = 0;
        throw new Error('شهادة توقيع التحديث لا تطابق شهادة توقيع تطبيق Sami الأصلية؛ تم حظر التثبيت.');
      }
    }

    webDownloadMemoryStore.verifiedBlob = new Blob([fullBytes.buffer as ArrayBuffer], {
      type: 'application/vnd.android.package-archive',
    });

    emitWebUpdateState({
      phase: 'verified',
      statusTextAr: 'اكتمل التنزيل',
      errorDetailAr: null,
      downloadedBytes: fullBytes.byteLength,
      totalBytes: fullBytes.byteLength,
      percent: 100,
      speedBytesPerSec: 0,
      canInstall: true,
      canResume: false,
      verifiedSha256: localSha256,
      verifiedSigningCertSha256: certColon || config.signingCertSha256 || null,
    });
  } catch (err: any) {
    webDownloadMemoryStore.abortCtrl = null;
    if (abortCtrl.signal.aborted) {
      return;
    }
    const dl = webDownloadMemoryStore.downloadedBytes;
    const pct = expectedTotal > 0 ? Math.min(99, Math.floor((dl * 99) / expectedTotal)) : 0;
    emitWebUpdateState({
      phase: 'failed',
      statusTextAr: 'فشل التنزيل',
      errorDetailAr: translateNetworkOrHttpErrorAr(err),
      downloadedBytes: dl,
      totalBytes: expectedTotal,
      percent: pct,
      speedBytesPerSec: 0,
      canInstall: false,
      canResume: dl > 0,
    });
  }
}

export function SamiUserUpdateModal({
  config,
  isOpen,
  onDismiss,
  isPreview = false,
}: {
  config: CloudAppUpdateConfig | null;
  isOpen: boolean;
  onDismiss?: () => void;
  isPreview?: boolean;
}) {
  const [currentInstalledInfo, setCurrentInstalledInfo] = useState<InstalledAppInfo>(() => getInstalledSamiAppInfo());
  const isNativeAndroid = currentInstalledInfo.isAndroidNative;
  const [externalOpened, setExternalOpened] = useState(false);

  const [dlState, setDlState] = useState<WebPersistedUpdateState>(() => {
    const w = typeof window !== 'undefined' ? (window as any) : {};
    if (isNativeAndroid && w.SamiBridge && typeof w.SamiBridge.getUpdateState === 'function') {
      try {
        const raw = JSON.parse(w.SamiBridge.getUpdateState());
        if (raw && (!config || Number(raw.targetVersionCode) === Number(config.versionCode))) {
          return raw;
        }
      } catch {}
    }
    if (config && webDownloadMemoryStore.versionCode === Number(config.versionCode)) {
      return webDownloadMemoryStore.state;
    }
    return {
      phase: 'idle',
      statusTextAr: '',
      errorDetailAr: null,
      targetVersionCode: config?.versionCode || 0,
      targetVersionName: config?.versionName || '',
      downloadedBytes: 0,
      totalBytes: config?.fileSize || 0,
      percent: 0,
      speedBytesPerSec: 0,
      canInstall: false,
      canResume: false,
      verifiedSha256: null,
      verifiedSigningCertSha256: null,
    };
  });

  const [webInstallNotice, setWebInstallNotice] = useState<string | null>(null);

  // Per-user version check: recheck installed version whenever the app starts or returns to foreground
  useEffect(() => {
    if (!isOpen || !config) return;

    const checkInstalledVersion = () => {
      const info = getInstalledSamiAppInfo();
      setCurrentInstalledInfo(info);
      if (Number(info.versionCode) >= Number(config.versionCode)) {
        if (onDismiss) onDismiss();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', checkInstalledVersion);
      const onVisChange = () => {
        if (document.visibilityState === 'visible') {
          checkInstalledVersion();
        }
      };
      document.addEventListener('visibilitychange', onVisChange);
      window.addEventListener('sami_native_update_state', checkInstalledVersion);
      window.addEventListener('sami_native_perm_update', checkInstalledVersion);

      return () => {
        window.removeEventListener('focus', checkInstalledVersion);
        document.removeEventListener('visibilitychange', onVisChange);
        window.removeEventListener('sami_native_update_state', checkInstalledVersion);
        window.removeEventListener('sami_native_perm_update', checkInstalledVersion);
      };
    }
  }, [isOpen, config, onDismiss]);

  useEffect(() => {
    if (!isOpen || !config) return;
    const w = typeof window !== 'undefined' ? (window as any) : {};

    if (isNativeAndroid) {
      const syncFromNative = (ev?: any) => {
        try {
          const detail = ev?.detail || (w.SamiBridge?.getUpdateState ? JSON.parse(w.SamiBridge.getUpdateState()) : null);
          if (detail && (detail.targetVersionCode === 0 || Number(detail.targetVersionCode) === Number(config.versionCode))) {
            setDlState(detail);
          }
        } catch {}
      };
      syncFromNative();
      window.addEventListener('sami_native_update_state', syncFromNative as EventListener);
      return () => {
        window.removeEventListener('sami_native_update_state', syncFromNative as EventListener);
      };
    } else {
      const listener = (next: WebPersistedUpdateState) => {
        if (next.targetVersionCode === 0 || Number(next.targetVersionCode) === Number(config.versionCode)) {
          setDlState({ ...next });
        }
      };
      webDownloadMemoryStore.listeners.add(listener);
      if (webDownloadMemoryStore.versionCode === Number(config.versionCode)) {
        setDlState({ ...webDownloadMemoryStore.state });
      }
      return () => {
        webDownloadMemoryStore.listeners.delete(listener);
      };
    }
  }, [isOpen, config?.versionCode, isNativeAndroid]);

  if (!isOpen || !config) return null;
  if (!isPreview && !shouldShowCloudAppUpdate(config)) return null;
  if (!isPreview && Number(currentInstalledInfo.versionCode) >= Number(config.versionCode)) return null;

  const isMandatory = Boolean(config.isMandatory);
  const isExternalDelivery =
    config.deliveryMethod === 'external_url' ||
    config.storageSource === 'external_url' ||
    (Boolean(config.externalDownloadUrl) && !config.githubReleaseId);
  const targetExternalUrl = (config.externalDownloadUrl || config.downloadUrl || '').trim();

  const phase = (dlState.phase || 'idle').toLowerCase();
  const isDownloading =
    phase === 'connecting' || phase === 'starting' || phase === 'downloading' || phase === 'resuming' || phase === 'verifying';
  const isPaused = phase === 'paused';
  const isFailed = phase === 'failed';
  const isVerifiedReady = phase === 'verified' && dlState.canInstall === true;
  const needsPerm = phase === 'needs_install_permission';
  const isInstalling = phase === 'installing';

  const handleStartDownload = () => {
    setWebInstallNotice(null);

    if (isExternalDelivery) {
      if (!targetExternalUrl || !targetExternalUrl.startsWith('https://')) {
        setDlState((prev) => ({
          ...prev,
          phase: 'failed',
          statusTextAr: 'رابط التنزيل غير صالح',
          errorDetailAr: 'رابط تنزيل APK الخارجي المحدد غير متوفر أو ليس رابط HTTPS آمن وصالح.',
        }));
        return;
      }
      const opened = openInExternalBrowser(targetExternalUrl);
      if (opened) {
        setExternalOpened(true);
        setDlState((prev) => ({
          ...prev,
          phase: 'idle',
          statusTextAr: 'تم فتح رابط التنزيل في المتصفح الخارجي',
        }));
      } else {
        setDlState((prev) => ({
          ...prev,
          phase: 'failed',
          statusTextAr: 'تعذر فتح المتصفح تلقائياً',
          errorDetailAr: 'يرجى فتح الرابط يدوياً في المتصفح: ' + targetExternalUrl,
        }));
      }
      return;
    }

    if (isPreview && !config.downloadUrl && !config.githubAssetId) {
      setDlState((prev) => ({
        ...prev,
        phase: 'failed',
        statusTextAr: 'فشل التنزيل',
        errorDetailAr: 'هذه معاينة تصميمية فقط؛ سيتم تفعيل التنزيل الفعلي فور رفع ملف الـ APK ونشره.',
      }));
      return;
    }

    const w = typeof window !== 'undefined' ? (window as any) : {};
    if (isNativeAndroid && w.SamiBridge?.startAppUpdateDownload) {
      const serverBase = getSamiServerBaseUrl();
      const { token, encodedSession } = getAuthCredentials();
      w.SamiBridge.startAppUpdateDownload(
        JSON.stringify(config),
        serverBase,
        JSON.stringify({ token, session: encodedSession })
      );
    } else {
      runWebResumableDownloadAndVerify(config, false);
    }
  };

  const handlePauseDownload = () => {
    const w = typeof window !== 'undefined' ? (window as any) : {};
    if (isNativeAndroid && w.SamiBridge?.pauseAppUpdateDownload) {
      try {
        setDlState(JSON.parse(w.SamiBridge.pauseAppUpdateDownload()));
      } catch {}
    } else {
      if (webDownloadMemoryStore.abortCtrl) {
        webDownloadMemoryStore.abortCtrl.abort();
        webDownloadMemoryStore.abortCtrl = null;
      }
      emitWebUpdateState({
        phase: 'paused',
        statusTextAr: 'تم إيقاف التنزيل مؤقتًا',
        speedBytesPerSec: 0,
        canResume: webDownloadMemoryStore.downloadedBytes > 0,
      });
    }
  };

  const handleResumeDownload = () => {
    const w = typeof window !== 'undefined' ? (window as any) : {};
    if (isNativeAndroid && w.SamiBridge?.resumeAppUpdateDownload) {
      const resStr = w.SamiBridge.resumeAppUpdateDownload();
      try {
        const parsed = JSON.parse(resStr);
        if (!parsed?.ok) {
          handleStartDownload();
        }
      } catch {
        handleStartDownload();
      }
    } else {
      runWebResumableDownloadAndVerify(config, true);
    }
  };

  const handleCancelDownload = () => {
    const w = typeof window !== 'undefined' ? (window as any) : {};
    if (isNativeAndroid && w.SamiBridge?.cancelAppUpdateDownload) {
      try {
        setDlState(JSON.parse(w.SamiBridge.cancelAppUpdateDownload()));
      } catch {}
    } else {
      if (webDownloadMemoryStore.abortCtrl) {
        webDownloadMemoryStore.abortCtrl.abort();
        webDownloadMemoryStore.abortCtrl = null;
      }
      webDownloadMemoryStore.chunks = [];
      webDownloadMemoryStore.downloadedBytes = 0;
      webDownloadMemoryStore.verifiedBlob = null;
      emitWebUpdateState({
        phase: 'idle',
        statusTextAr: '',
        errorDetailAr: null,
        downloadedBytes: 0,
        percent: 0,
        speedBytesPerSec: 0,
        canInstall: false,
        canResume: false,
      });
    }
  };

  const handleInstallVerifiedApk = () => {
    const w = typeof window !== 'undefined' ? (window as any) : {};
    if (isNativeAndroid && w.SamiBridge?.installVerifiedAppUpdate) {
      w.SamiBridge.installVerifiedAppUpdate();
      return;
    }

    // Browser environment: save the verified APK cleanly via invisible blob anchor without opening external windows
    if (webDownloadMemoryStore.verifiedBlob) {
      const blobUrl = URL.createObjectURL(webDownloadMemoryStore.verifiedBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = config.fileName || `Sami-v${config.versionName}.apk`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      setWebInstallNotice(
        'تم التحقق من سلامة الحزمة وشهادة التوقيع وحفظ ملف الـ APK المعتمد على جهازك. داخل تطبيق Sami على هاتف Android يفتح هذا الزر مثبّت النظام الرسمي مباشرة.'
      );
    }
  };

  const totalSizeDisplay = dlState.totalBytes > 0 ? dlState.totalBytes : config.fileSize || 0;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-[#090d17] border border-amber-500/40 rounded-2xl p-6 shadow-2xl text-right space-y-4">
        {/* Header Identity */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0 font-black text-lg">
              {isMandatory ? '⚡' : '✦'}
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {isMandatory ? 'تحديث إلزامي لتطبيق Sami' : 'تحديث جديد متاح لتطبيق Sami'}
              </h3>
              <p className="text-xs font-bold mt-0.5 text-amber-300/90">
                {isMandatory
                  ? 'يلزم تثبيت هذا التحديث للمتابعة وضمان استقرار الحساب والبيانات'
                  : isExternalDelivery
                    ? 'رابط تحميل رسمي متاح للتحميل والتثبيت المباشر'
                    : 'إصدار محدث جاهز للتنزيل والتثبيت المباشر من داخل التطبيق'}
              </p>
            </div>
          </div>
          <span
            className={`text-[10px] font-black px-2.5 py-1 rounded-md border shrink-0 ${
              isMandatory
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                : 'bg-amber-400/10 border-amber-400/30 text-amber-300'
            }`}
          >
            {isMandatory ? 'إلزامي' : 'اختياري'}
          </span>
        </div>

        {/* Version & Size Telemetry Grid */}
        <div className="grid grid-cols-3 gap-2 bg-[#0d1322] border border-slate-800 rounded-xl p-3 text-center">
          <div className="border-l border-slate-800/80 pl-2">
            <span className="block text-[10px] text-slate-400 font-bold">الإصدار المثبت</span>
            <span
              dir="ltr"
              className="block text-xs font-black text-slate-200 font-['JetBrains_Mono',monospace] tabular-nums mt-0.5"
            >
              v{currentInstalledInfo.versionName}
            </span>
            <span className="block text-[10px] text-slate-500 font-['JetBrains_Mono',monospace] tabular-nums">
              Build {currentInstalledInfo.versionCode}
            </span>
          </div>

          <div className="border-l border-slate-800/80 pl-2">
            <span className="block text-[10px] text-amber-400 font-bold">الإصدار الجديد</span>
            <span
              dir="ltr"
              className="block text-sm font-black text-amber-300 font-['JetBrains_Mono',monospace] tabular-nums mt-0.5"
            >
              v{config.versionName}
            </span>
            <span className="block text-[10px] text-amber-200/70 font-['JetBrains_Mono',monospace] tabular-nums">
              Build {config.versionCode}
            </span>
          </div>

          <div>
            <span className="block text-[10px] text-slate-400 font-bold">نوع التوزيع</span>
            <span
              className="block text-xs font-black text-slate-100 mt-0.5"
            >
              {isExternalDelivery ? 'رابط APK خارجي' : totalSizeDisplay > 0 ? formatBytesAr(totalSizeDisplay) : 'APK رسمي'}
            </span>
            <span className="block text-[10px] text-emerald-400 font-bold">موقّع وموثّق</span>
          </div>
        </div>

        {/* Release Notes */}
        {config.description && (
          <div className="bg-[#0b0f19] border border-slate-800/90 rounded-xl p-3.5">
            <span className="block text-[11px] font-black text-amber-400 mb-1.5">تفاصيل التحديث وما الجديد:</span>
            <p className="text-xs text-slate-300 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
              {config.description}
            </p>
          </div>
        )}

        {/* External Download Browser Notice */}
        {externalOpened && (
          <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-3.5 text-xs space-y-2">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <span>🌐</span>
              <span>تم فتح رابط التنزيل في متصفح النظام</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              قم بتحميل حزمة الـ APK وتثبيتها. عند العودة إلى تطبيق Sami بعد اكتمال التثبيت، سيكتشف التطبيق رقم الإصدار الجديد تلقائياً ويغلق هذه النافذة فوراً.
            </p>
            <button
              type="button"
              onClick={() => openInExternalBrowser(targetExternalUrl)}
              className="px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 text-[11px] font-bold cursor-pointer transition"
            >
              إعادة فتح رابط التحميل في المتصفح
            </button>
          </div>
        )}

        {/* Live Download & Verification Progress Box (for GitHub / In-App streaming) */}
        {!isExternalDelivery && phase !== 'idle' && (
          <div className="bg-[#0b101d] border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span
                className={`font-black ${
                  isFailed
                    ? 'text-rose-400'
                    : isVerifiedReady
                      ? 'text-emerald-400'
                      : 'text-amber-300'
                }`}
              >
                {dlState.statusTextAr || 'جارٍ معالجة التحديث'}
              </span>
              <span
                dir="ltr"
                className="font-black text-slate-100 font-['JetBrains_Mono',monospace] tabular-nums"
              >
                {dlState.percent}%
              </span>
            </div>

            <GoldProgressBar
              percent={dlState.percent}
              variant={isFailed ? 'rose' : isVerifiedReady ? 'emerald' : 'gold'}
            />

            <div className="flex items-center justify-between text-[11px] text-slate-400 font-['JetBrains_Mono',monospace] tabular-nums">
              <span dir="ltr">
                {formatBytesAr(dlState.downloadedBytes)} / {formatBytesAr(totalSizeDisplay)}
              </span>
              <span dir="ltr" className="text-amber-300">
                {isDownloading && dlState.speedBytesPerSec > 0 ? formatSpeedAr(dlState.speedBytesPerSec) : ''}
              </span>
            </div>

            {isVerifiedReady && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5 text-[11px] text-emerald-300 font-bold">
                ✓ تم التحقق من اكتمال الحجم وبصمة SHA-256 ومطابقة شهادة توقيع Sami الأصلية بنجاح.
              </div>
            )}

            {needsPerm && (
              <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg p-2.5 text-[11px] text-amber-200 font-bold">
                يرجى تفعيل خيار «السماح من هذا المصدر» في شاشة إعدادات Android ثم العودة لإتمام التثبيت تلقائياً.
              </div>
            )}

            {dlState.errorDetailAr && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 text-[11px] text-rose-300 leading-relaxed">
                {dlState.errorDetailAr}
              </div>
            )}

            {webInstallNotice && (
              <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg p-2.5 text-[11px] text-amber-200 leading-relaxed">
                {webInstallNotice}
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="space-y-2 pt-1">
          {/* Verified -> Show ONLY Official Install Button */}
          {!isExternalDelivery && (isVerifiedReady || needsPerm || isInstalling) && (
            <button
              type="button"
              onClick={handleInstallVerifiedApk}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <span>✅ تثبيت التحديث الآن</span>
            </button>
          )}

          {/* Idle / External -> Primary Download Now Button */}
          {(isExternalDelivery || phase === 'idle') && (!isVerifiedReady && !needsPerm && !isInstalling) && (
            <button
              type="button"
              onClick={handleStartDownload}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <span>{isExternalDelivery ? 'تحميل التحديث من الرابط الخارجي 🌐' : 'تحميل التحديث الآن'}</span>
            </button>
          )}

          {/* Active Downloading -> Pause + Cancel */}
          {!isExternalDelivery && isDownloading && phase !== 'verifying' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePauseDownload}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-400/30 text-amber-300 font-black text-xs transition cursor-pointer"
              >
                إيقاف مؤقت
              </button>
              {!isMandatory && (
                <button
                  type="button"
                  onClick={handleCancelDownload}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  إلغاء
                </button>
              )}
            </div>
          )}

          {/* Paused or Failed -> Resume / Retry + Cancel */}
          {!isExternalDelivery && (isPaused || isFailed) && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={dlState.canResume ? handleResumeDownload : handleStartDownload}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs transition cursor-pointer"
              >
                {dlState.canResume ? 'استئناف التنزيل' : 'إعادة المحاولة'}
              </button>
              <button
                type="button"
                onClick={handleCancelDownload}
                className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          )}

          {/* Optional Update Dismissal («لاحقًا») — STRICTLY HIDDEN FOR MANDATORY UPDATES */}
          {!isMandatory && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0d121d] hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 font-bold text-xs border border-slate-800 transition cursor-pointer"
            >
              {isPreview ? 'إغلاق المعاينة' : 'لاحقًا'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PART 2: OWNER ADMIN APK ATTACHMENT & FIREBASE PUBLISHING PANEL
// ============================================================================

export const SamiAdminUpdatePanel = SamiAdminFirebaseUpdatePanel;

// ============================================================================
// EXPOSE GLOBALS FOR SAMI BUNDLE INTEGRATION
// ============================================================================

if (typeof window !== 'undefined') {
  const w = window as any;
  w.SamiUserUpdateModal = SamiUserUpdateModal;
  w.SamiAdminUpdatePanel = SamiAdminUpdatePanel;
  w.shouldShowSamiCloudUpdate = shouldShowCloudAppUpdate;
  w.getInstalledSamiAppInfo = getInstalledSamiAppInfo;
  w.getSamiServerBaseUrl = getSamiServerBaseUrl;
  w.SamiChannelMembersModal = SamiChannelMembersModal;
  w.SamiEmojiBar = SamiEmojiBar;
  w.SamiMessageReactions = SamiMessageReactions;
  w.SamiPinButton = SamiPinButton;
  w.SamiPinnedBanner = SamiPinnedBanner;
  w.samiToggleReaction = toggleMessageReaction;
  w.samiTogglePin = toggleMessagePin;
  w.SAMI_EMOJIS = SAMI_EMOJIS;
}

export {
  SamiChannelMembersModal,
  SamiEmojiBar,
  SamiMessageReactions,
  SamiPinButton,
  SamiPinnedBanner,
  toggleMessageReaction,
  toggleMessagePin,
  SAMI_EMOJIS,
};

import React, { useState, useEffect } from './samiReactShim.ts';

export const SAMI_EMOJIS = ['❤️', '😂', '👍', '🔥', '👏', '😮'];

function getActiveAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const raw = localStorage.getItem('sami_active_session') || sessionStorage.getItem('sami_active_session');
    if (raw) {
      const u = JSON.parse(raw);
      if (u && u.id) {
        headers['x-sami-session'] = encodeURIComponent(
          JSON.stringify({
            id: u.id,
            username: u.username || '',
            displayName: u.displayName || '',
            role: u.role || 'user',
            isGuest: !!u.isGuest,
          })
        );
        if (u.token) headers.Authorization = `Bearer ${u.token}`;
      }
    }
  } catch {}
  return headers;
}

export async function toggleMessageReaction(params: {
  messageId: string;
  emoji: string;
  channelId?: string;
  conversationId?: string;
}): Promise<Record<string, number[]>> {
  const headers = getActiveAuthHeaders();
  let url = '';
  let body: any = { emoji: params.emoji };

  if (params.channelId) {
    url = `/api/channels/${encodeURIComponent(params.channelId)}/messages/${encodeURIComponent(params.messageId)}/reaction`;
  } else {
    url = `/api/private-messages/${encodeURIComponent(params.messageId)}/reaction`;
    body.conversationId = params.conversationId;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || 'فشل تسجيل التفاعل');
  }
  const reactions = json.reactions || {};
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sami-reaction-changed', {
        detail: { messageId: params.messageId, reactions },
      })
    );
  }
  return reactions;
}

export async function toggleMessagePin(params: {
  messageId: string;
  channelId?: string;
  conversationId?: string;
}): Promise<boolean> {
  const headers = getActiveAuthHeaders();
  let url = '';
  let body: any = {};

  if (params.channelId) {
    url = `/api/channels/${encodeURIComponent(params.channelId)}/messages/${encodeURIComponent(params.messageId)}/pin`;
  } else {
    url = `/api/private-messages/${encodeURIComponent(params.messageId)}/pin`;
    body.conversationId = params.conversationId;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || 'فشل تثبيت الرسالة');
  }
  return Boolean(json.pinned);
}

/**
 * Modern floating emoji bar displayed inside or above the message context menu
 */
export function SamiEmojiBar({
  msg,
  onClose,
  channelId,
  conversationId,
  onUpdated,
}: {
  msg: any;
  onClose: () => void;
  channelId?: string;
  conversationId?: string;
  onUpdated?: (reactions: Record<string, number[]>) => void;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const effectiveChannelId = channelId || msg.channelId;

  const handleEmojiClick = async (emoji: string) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const reactions = await toggleMessageReaction({
        messageId: msg.id,
        emoji,
        channelId: effectiveChannelId,
        conversationId,
      });
      msg.reactions = reactions;
      if (onUpdated) onUpdated(reactions);
    } catch (err: any) {
      console.warn('[Reaction] Error toggling:', err.message);
    } finally {
      setIsBusy(false);
      onClose();
    }
  };

  return (
    <div className="sami-emoji-bar" onClick={(e) => e.stopPropagation()}>
      {SAMI_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="sami-emoji-btn"
          disabled={isBusy}
          onClick={() => handleEmojiClick(emoji)}
          title={`تفاعل بـ ${emoji}`}
        >
          <span>{emoji}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Reaction Pill Badges displayed below message bubbles
 */
export function SamiMessageReactions({
  msg,
  currentUserId,
  channelId,
  conversationId,
  onUpdated,
}: {
  msg: any;
  currentUserId?: number;
  channelId?: string;
  conversationId?: string;
  onUpdated?: (reactions: Record<string, number[]>) => void;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: any) => {
      if (e.detail?.messageId === msg.id && e.detail?.reactions) {
        msg.reactions = e.detail.reactions;
        setTick((t) => t + 1);
      }
    };
    window.addEventListener('sami-reaction-changed', handler);
    return () => window.removeEventListener('sami-reaction-changed', handler);
  }, [msg.id]);

  let effectiveUid = currentUserId;
  if (!effectiveUid && typeof window !== 'undefined') {
    try {
      const raw =
        localStorage.getItem('sami_active_session') ||
        sessionStorage.getItem('sami_active_session') ||
        localStorage.getItem('sami_auth_user_session');
      if (raw) {
        const u = JSON.parse(raw);
        if (u && u.id) effectiveUid = Number(u.id);
      }
      if (!effectiveUid) {
        const uidStr = localStorage.getItem('sami_active_uid');
        if (uidStr) effectiveUid = Number(uidStr);
      }
    } catch {}
  }

  const effectiveChannelId = channelId || msg.channelId;
  const reactions: Record<string, number[]> = msg.reactions || {};
  const entries = Object.entries(reactions).filter(([_, uids]) => Array.isArray(uids) && uids.length > 0);

  if (entries.length === 0) return null;

  const handlePillClick = async (emoji: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await toggleMessageReaction({
        messageId: msg.id,
        emoji,
        channelId: effectiveChannelId,
        conversationId,
      });
      msg.reactions = updated;
      if (onUpdated) onUpdated(updated);
      setTick((t) => t + 1);
    } catch (err: any) {
      console.warn('[Reaction] Error:', err.message);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
      {entries.map(([emoji, uids]) => {
        const isActive = effectiveUid ? uids.some((id) => Number(id) === Number(effectiveUid)) : false;
        return (
          <button
            key={emoji}
            type="button"
            className={`sami-reaction-pill ${isActive ? 'is-active' : ''}`}
            onClick={(e) => handlePillClick(emoji, e)}
            title={`${uids.length} تفاعل`}
          >
            <span className="text-xs">{emoji}</span>
            <span className="font-mono text-[10px] font-bold">{uids.length}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Pin / Unpin Button inside the message action menu
 */
export function SamiPinButton({
  msg,
  currentUser,
  channelId,
  conversationId,
  onClose,
  onPinToggled,
}: {
  msg: any;
  currentUser: any;
  channelId?: string;
  conversationId?: string;
  onClose: () => void;
  onPinToggled?: (isPinned: boolean) => void;
}) {
  const isLeaderOrMod =
    currentUser?.id === 1 ||
    currentUser?.role === 'owner' ||
    currentUser?.role === 'moderator' ||
    Boolean(conversationId); // in PMs, both can pin

  if (!isLeaderOrMod) return null;

  const isPinned = Boolean(msg.isPinned);

  const handleTogglePin = async () => {
    try {
      const nextPinned = await toggleMessagePin({
        messageId: msg.id,
        channelId,
        conversationId,
      });
      msg.isPinned = nextPinned;
      if (onPinToggled) onPinToggled(nextPinned);
    } catch (err: any) {
      console.warn('[Pin] Error:', err.message);
    } finally {
      onClose();
    }
  };

  return (
    <button
      type="button"
      onClick={handleTogglePin}
      className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-100 hover:text-amber-300 hover:bg-amber-500/15 flex items-center gap-2.5 transition border-t border-slate-800/80 mt-1"
    >
      <span className="text-amber-400">📌</span>
      <span>{isPinned ? 'إلغاء تثبيت الرسالة' : 'تثبيت الرسالة في الأعلى'}</span>
    </button>
  );
}

/**
 * Pinned Message Header Banner
 */
export function SamiPinnedBanner({
  pinnedMsg,
  onJump,
  onUnpin,
  canUnpin,
}: {
  pinnedMsg: any;
  onJump: () => void;
  onUnpin: () => void;
  canUnpin: boolean;
}) {
  if (!pinnedMsg) return null;

  return (
    <div
      className="sami-pinned-bar px-3 py-1.5 flex items-center justify-between gap-2 text-xs cursor-pointer select-none"
      onClick={onJump}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-amber-400 text-sm shrink-0">📌</span>
        <div className="min-w-0">
          <span className="font-bold text-amber-300 ml-1.5">{pinnedMsg.senderName}:</span>
          <span className="text-slate-200 truncate">{pinnedMsg.text || 'مرفق وسائط'}</span>
        </div>
      </div>
      {canUnpin && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUnpin();
          }}
          className="text-slate-400 hover:text-white p-1 rounded-md text-xs font-bold"
          title="إلغاء التثبيت"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Expose globals for bundle runtime
if (typeof window !== 'undefined') {
  const w = window as any;
  w.SamiEmojiBar = SamiEmojiBar;
  w.SamiMessageReactions = SamiMessageReactions;
  w.SamiPinButton = SamiPinButton;
  w.SamiPinnedBanner = SamiPinnedBanner;
  w.samiToggleReaction = toggleMessageReaction;
  w.samiTogglePin = toggleMessagePin;
}

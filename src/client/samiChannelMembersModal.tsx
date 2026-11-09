import React, { useState, useEffect, useMemo } from './samiReactShim.ts';

export interface ChannelRecordItem {
  id: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
  isOpenPublic?: boolean;
  password?: string;
  imageUrl?: string | null;
  storagePath?: string | null;
  visibility?: 'public' | 'visible' | 'hidden';
  allowedMemberIds?: number[];
  memberIds?: number[];
  createdAt?: number;
  updatedAt?: number;
  displayMemberCount?: number | null;
}

export interface UserSummaryItem {
  id: number;
  username: string;
  displayName: string;
  role: string;
  avatarUrl?: string | null;
}

interface MemberDetail {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  role: string;
  isOwner: boolean;
  status: string;
}

function getClientAuthHeaders(): Record<string, string> {
  let token = '';
  let rawSession = '';
  try {
    rawSession = localStorage.getItem('sami_auth_user_session') || '';
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (parsed && parsed.token) token = String(parsed.token);
    }
  } catch {}

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (rawSession) headers['X-Sami-Session'] = encodeURIComponent(rawSession);
  return headers;
}

const AVATAR_COLORS = [
  '#FFD700', '#38BDF8', '#34D399', '#F472B6', '#A78BFA',
  '#FB923C', '#2DD4BF', '#F87171', '#A3E635', '#60A5FA',
];

function getUserAvatarColor(id: number | string): string {
  const num = typeof id === 'number' ? id : parseInt(String(id), 10) || 1;
  return AVATAR_COLORS[Math.abs(num) % AVATAR_COLORS.length];
}

export function SamiChannelMembersModal({
  channel,
  allUsers = [],
  isOpen,
  onClose,
  onMembersUpdated,
}: {
  channel: ChannelRecordItem | null;
  allUsers: UserSummaryItem[];
  isOpen: boolean;
  onClose: () => void;
  onMembersUpdated?: (updated: ChannelRecordItem) => void;
}) {
  const [activeTab, setActiveTab] = useState<'members' | 'add'>('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [members, setMembers] = useState<MemberDetail[]>([]);
  const [allowedIds, setAllowedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ text: string; isError?: boolean } | null>(null);

  // Synchronize initial channel allowed IDs
  useEffect(() => {
    if (!channel) return;
    const initialIds = Array.isArray(channel.allowedMemberIds)
      ? Array.from(new Set([1, ...channel.allowedMemberIds]))
      : [1];
    setAllowedIds(initialIds);
    setSelectedUserIds([]);
    setSearchQuery('');
    setNotification(null);
  }, [channel?.id]);

  // Fetch updated member details from backend
  const fetchMembers = async () => {
    if (!channel) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/channels/${encodeURIComponent(channel.id)}/members`, {
        headers: getClientAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.members)) {
          setMembers(json.members);
          if (Array.isArray(json.allowedMemberIds)) {
            setAllowedIds(json.allowedMemberIds);
          }
          return;
        }
      }
    } catch {}

    // Fallback: build from allUsers prop and allowedIds
    buildFallbackMembers(allowedIds);
    setLoading(false);
  };

  const buildFallbackMembers = (ids: number[]) => {
    const list: MemberDetail[] = ids.map((id) => {
      const u = allUsers.find((user) => user.id === id);
      return {
        id,
        username: u ? u.username : `user_${id}`,
        displayName: u ? u.displayName || u.username : `مستخدم #${id}`,
        avatarUrl: u?.avatarUrl || null,
        role: u?.role || 'user',
        isOwner: id === 1,
        status: id === 1 ? 'مالك القناة (Owner)' : 'مصرح له (Authorized Member)',
      };
    });
    setMembers(list);
  };

  useEffect(() => {
    if (isOpen && channel) {
      fetchMembers();
    }
  }, [isOpen, channel?.id]);

  const showNotice = (text: string, isError = false) => {
    setNotification({ text, isError });
    setTimeout(() => {
      setNotification((curr) => (curr?.text === text ? null : curr));
    }, 4000);
  };

  // Add selected users to channel
  const handleAddSelectedUsers = async () => {
    if (!channel || selectedUserIds.length === 0) {
      showNotice('يرجى تحديد مستخدم واحد على الأقل لإضافته', true);
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`/api/channels/${encodeURIComponent(channel.id)}/members/add`, {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ userIds: selectedUserIds }),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        const newIds = Array.from(new Set([1, ...allowedIds, ...selectedUserIds]));
        setAllowedIds(newIds);
        if (Array.isArray(json.members)) {
          setMembers(json.members);
        } else {
          buildFallbackMembers(newIds);
        }

        const count = selectedUserIds.length;
        setSelectedUserIds([]);
        showNotice(`تمت إضافة ${count} مستخدم بنجاح إلى القناة وأصبحوا مؤهلين لدخولها بكلمة المرور`);
        setActiveTab('members');

        const updatedChan: ChannelRecordItem = json.channel || {
          ...channel,
          allowedMemberIds: newIds,
          memberIds: newIds,
        };
        onMembersUpdated?.(updatedChan);
      } else {
        showNotice(json.error || 'تعذر إضافة المستخدمين إلى القناة', true);
      }
    } catch (e: any) {
      showNotice(e?.message || 'فشل الاتصال بالخادم لإضافة الأعضاء', true);
    } finally {
      setActionLoading(false);
    }
  };

  // Remove a specific user from channel
  const handleRemoveUser = async (userId: number, userName: string) => {
    if (!channel) return;
    if (userId === 1) {
      showNotice('لا يمكن إزالة مالك التطبيق الرئيسي من القناة', true);
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`/api/channels/${encodeURIComponent(channel.id)}/members/remove`, {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ userId }),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        const newIds = allowedIds.filter((id) => id !== userId);
        setAllowedIds(newIds);
        setMembers((prev) => prev.filter((m) => m.id !== userId));
        showNotice(`تمت إزالة ${userName} بنجاح وإلغاء تصريح دخوله للقناة ومرفقاتها فوراً`);

        const updatedChan: ChannelRecordItem = json.channel || {
          ...channel,
          allowedMemberIds: newIds,
          memberIds: (channel.memberIds || []).filter((id) => id !== userId),
        };
        onMembersUpdated?.(updatedChan);
      } else {
        showNotice(json.error || 'تعذر إزالة المستخدم من القناة', true);
      }
    } catch (e: any) {
      showNotice(e?.message || 'فشل الاتصال بالخادم لإزالة العضو', true);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter available registered users not yet added
  const availableUsersToAdd = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (allowedIds.includes(u.id)) return false;
      if (!q) return true;
      const matchName = (u.displayName || '').toLowerCase().includes(q);
      const matchUser = (u.username || '').toLowerCase().includes(q);
      const matchId = String(u.id).includes(q);
      return matchName || matchUser || matchId;
    });
  }, [allUsers, allowedIds, searchQuery]);

  const toggleSelectUser = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedUserIds(availableUsersToAdd.map((u) => u.id));
  };

  const handleDeselectAll = () => {
    setSelectedUserIds([]);
  };

  if (!isOpen || !channel) return null;

  const isOpenPublic = Boolean(
    channel.isOpenPublic === true ||
      (!channel.password?.trim() && channel.isOpenPublic !== false && !channel.isPrivate)
  );

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="bg-[#0b101d] border border-amber-500/40 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-right">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/20 via-[#121929] to-[#121929] border-b border-slate-800 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 text-xl font-black shrink-0">
              👥
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">{channel.name}</h3>
                {isOpenPublic ? (
                  <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 rounded-md">
                    🌐 عامة مفتوحة
                  </span>
                ) : (
                  <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 rounded-md">
                    🔒 محمية بكلمة مرور (مستقلة)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-bold">
                إدارة أعضاء القناة المستقلة • Manage Channel Members
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-black transition cursor-pointer"
            title="إغلاق"
          >
            ✕
          </button>
        </div>

        {/* Notifications Bar */}
        {notification && (
          <div
            className={`p-3 mx-4 mt-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
              notification.isError
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <span>{notification.isError ? '⚠️' : '✅'}</span>
            <span>{notification.text}</span>
          </div>
        )}

        {/* Access Rule Hint */}
        <div className="mx-4 mt-3 p-3 rounded-2xl bg-[#121929] border border-amber-500/30 text-slate-300 text-xs leading-relaxed">
          <span className="text-amber-400 font-bold ml-1">قاعدة التصريح:</span>
          {isOpenPublic
            ? 'القناة العامة مفتوحة لجميع المسجلين دون الحاجة لإضافة يدوية أو كلمة مرور.'
            : 'القنوات المحمية تتطلب شرطين معاً: (1) إضافة المشرف للمستخدم هنا + (2) إدخال كلمة المرور الصحيحة. معرفة كلمة المرور وحدها لا تمنح الدخول أبداً.'}
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 p-4 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'members'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'bg-[#121929] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>الأعضاء المصرح لهم حالياً</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'members' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {members.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className={`py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'add'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'bg-[#121929] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>➕ إضافة مستخدمين جدد</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'add' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {availableUsersToAdd.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Current Members */}
        {activeTab === 'members' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {loading ? (
              <div className="text-center py-10 text-slate-400 text-xs">جارٍ تحميل قائمة الأعضاء...</div>
            ) : members.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                لا يوجد أعضاء مصرح لهم حالياً في هذه القناة.
              </div>
            ) : (
              members.map((m) => (
                <div
                  key={m.id}
                  className="bg-[#121929] border border-slate-800 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-sm hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3">
                    {m.avatarUrl ? (
                      <img
                        src={m.avatarUrl}
                        alt={m.displayName}
                        className="w-10 h-10 rounded-full object-cover border border-amber-400/40"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border border-slate-700"
                        style={{
                          backgroundColor: '#070b14',
                          color: getUserAvatarColor(m.id),
                        }}
                      >
                        {m.displayName ? m.displayName.charAt(0) : 'U'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-white">{m.displayName}</span>
                        <span className="text-[11px] text-slate-400 font-mono">@{m.username}</span>
                        {m.isOwner ? (
                          <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.5 rounded">
                            👑 المالك
                          </span>
                        ) : m.role === 'moderator' ? (
                          <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.5 rounded">
                            🛡️ مشرف
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                            مستخدم
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
                        <span>المعرف: #{m.id}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-sans font-bold">{m.status}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {m.isOwner || m.id === 1 ? (
                      <span className="text-[11px] text-amber-400/70 bg-amber-500/10 border border-amber-400/20 px-2.5 py-1 rounded-xl font-bold">
                        المالك الأساسي
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleRemoveUser(m.id, m.displayName)}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="إزالة العضو من القناة"
                      >
                        <span>🗑️</span>
                        <span>إزالة (Remove)</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Add Members */}
        {activeTab === 'add' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 ابحث بالاسم المعروض، اسم المستخدم للدخول، أو المعرف الرقمي..."
                className="w-full bg-[#121929] border border-slate-700 focus:border-amber-400 rounded-2xl px-4 py-2.5 text-xs text-white outline-none transition"
              />
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  تحديد الكل
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  إلغاء التحديد
                </button>
              </div>
              <span className="text-amber-400 font-bold">
                تم تحديد {selectedUserIds.length} مستخدم
              </span>
            </div>

            {/* List of eligible users */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {availableUsersToAdd.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  {searchQuery ? 'لا توجد نتائج مطابقة لبحثك' : 'تمت إضافة جميع المستخدمين المسجلين بالفعل لهذه القناة'}
                </div>
              ) : (
                availableUsersToAdd.map((u) => {
                  const isSelected = selectedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleSelectUser(u.id)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-400/60 text-white'
                          : 'bg-[#121929] border-slate-800 text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center text-xs font-black transition ${
                            isSelected
                              ? 'bg-amber-400 border-amber-400 text-slate-950'
                              : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {isSelected && '✓'}
                        </div>
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt={u.displayName}
                            className="w-9 h-9 rounded-full object-cover border border-slate-700"
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center font-black text-xs border border-slate-700"
                            style={{
                              backgroundColor: '#070b14',
                              color: getUserAvatarColor(u.id),
                            }}
                          >
                            {u.displayName ? u.displayName.charAt(0) : 'U'}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white">{u.displayName}</span>
                            <span className="text-[11px] text-slate-400 font-mono">@{u.username}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            معرف #{u.id} • {u.role === 'moderator' ? 'مشرف' : 'مستخدم'}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                          isSelected ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isSelected ? 'محدد' : 'انقر للتحديد'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Submit Add Button */}
            <button
              type="button"
              disabled={selectedUserIds.length === 0 || actionLoading}
              onClick={handleAddSelectedUsers}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>➕</span>
              <span>
                إضافة المستخدمين المحددين للقناة ({selectedUserIds.length}) وحفظ الصلاحيات
              </span>
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 bg-[#0a0e1a] border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>إجمالي الأعضاء المصرح لهم: <strong className="text-amber-400">{members.length}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

if (typeof window !== 'undefined') {
  (window as any).SamiChannelMembersModal = SamiChannelMembersModal;
}

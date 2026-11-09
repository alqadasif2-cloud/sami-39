import os
import re

files_to_patch = [
    'public/assets/index-DoqMLvwt.js',
    'app/src/main/assets/assets/index-DoqMLvwt.js'
]

updater_files = [
    'public/assets/sami-updater.js',
    'app/src/main/assets/assets/sami-updater.js'
]

def patch_bundle(path):
    print(f"=== Patching bundle: {path} ===")
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. Add reactions and isPinned to channel messages unpacking (function uw)
    old_uw = "replyToIsDeleted:!!n.replyToIsDeleted,updatedAt:typeof n.updatedAt==`number`?n.updatedAt:void 0}"
    new_uw = "replyToIsDeleted:!!n.replyToIsDeleted,updatedAt:typeof n.updatedAt==`number`?n.updatedAt:void 0,reactions:n.reactions&&typeof n.reactions===`object`?n.reactions:{},isPinned:!!n.isPinned}"
    if old_uw in code:
        code = code.replace(old_uw, new_uw, 1)
        print("  ✓ Patch 1: Added reactions & isPinned to channel message unpacking (uw)")
    else:
        print("  - Patch 1: Target not found or already applied")

    # 2. Add reactions and isPinned to private messages unpacking (function gw)
    old_gw = 'fileType:typeof n.fileType=="string"?n.fileType:void 0,fileUrl:typeof n.fileUrl=="string"?n.fileUrl:void 0,audioUrl:typeof n.audioUrl=="string"?n.audioUrl:(typeof n.fileType=="string"&&n.fileType.startsWith("audio/")&&typeof n.fileUrl=="string"?n.fileUrl:void 0),audioDuration:typeof n.audioDuration=="number"?n.audioDuration:void 0,timestamp:Number(n.timestamp||Date.now()),isEdited:!!n.isEdited,isDeleted:!!n.isDeleted,deletedAt:typeof n.deletedAt=="number"?n.deletedAt:void 0,deletedBy:typeof n.deletedBy=="number"?n.deletedBy:void 0,replyToId:typeof n.replyToId=="string"?n.replyToId:null,replyToSenderName:typeof n.replyToSenderName=="string"?n.replyToSenderName:null,replyToText:typeof n.replyToText=="string"?n.replyToText:null,replyToIsDeleted:!!n.replyToIsDeleted,updatedAt:typeof n.updatedAt=="number"?n.updatedAt:void 0}'
    new_gw = 'fileType:typeof n.fileType=="string"?n.fileType:void 0,fileUrl:typeof n.fileUrl=="string"?n.fileUrl:void 0,audioUrl:typeof n.audioUrl=="string"?n.audioUrl:(typeof n.fileType=="string"&&n.fileType.startsWith("audio/")&&typeof n.fileUrl=="string"?n.fileUrl:void 0),audioDuration:typeof n.audioDuration=="number"?n.audioDuration:void 0,timestamp:Number(n.timestamp||Date.now()),isEdited:!!n.isEdited,isDeleted:!!n.isDeleted,deletedAt:typeof n.deletedAt=="number"?n.deletedAt:void 0,deletedBy:typeof n.deletedBy=="number"?n.deletedBy:void 0,replyToId:typeof n.replyToId=="string"?n.replyToId:null,replyToSenderName:typeof n.replyToSenderName=="string"?n.replyToSenderName:null,replyToText:typeof n.replyToText=="string"?n.replyToText:null,replyToIsDeleted:!!n.replyToIsDeleted,updatedAt:typeof n.updatedAt=="number"?n.updatedAt:void 0,reactions:n.reactions&&typeof n.reactions==="object"?n.reactions:{},isPinned:!!n.isPinned}'
    if old_gw in code:
        code = code.replace(old_gw, new_gw, 1)
        print("  ✓ Patch 2: Added reactions & isPinned to private message unpacking (gw)")
    else:
        print("  - Patch 2: Target not found or already applied")

    # 3. Pass channelId and currentUserId to SamiMessageReactions
    old_react_render = "typeof window!==`undefined`&&window.SamiMessageReactions&&(0,$.jsx)(window.SamiMessageReactions,{msg:e})]"
    new_react_render = "typeof window!==`undefined`&&window.SamiMessageReactions&&(0,$.jsx)(window.SamiMessageReactions,{msg:e,channelId:v?.id||e.channelId,conversationId:b?String(b):void 0,currentUserId:currentUser?.id})]"
    if old_react_render in code:
        code = code.replace(old_react_render, new_react_render, 1)
        print("  ✓ Patch 3: Passed channelId and currentUserId to SamiMessageReactions")
    else:
        print("  - Patch 3: Target not found or already applied")

    # 4. Pass channelId and conversationId to SamiEmojiBar
    old_emojibar_render = "typeof window!==`undefined`&&window.SamiEmojiBar&&(0,$.jsx)(window.SamiEmojiBar,{msg:e,onClose:()=>g(!1)})"
    new_emojibar_render = "typeof window!==`undefined`&&window.SamiEmojiBar&&(0,$.jsx)(window.SamiEmojiBar,{msg:e,channelId:v?.id||e.channelId,conversationId:b?String(b):void 0,onClose:()=>g(!1)})"
    if old_emojibar_render in code:
        code = code.replace(old_emojibar_render, new_emojibar_render, 1)
        print("  ✓ Patch 4: Passed channelId & conversationId to SamiEmojiBar")
    else:
        print("  - Patch 4: Target not found or already applied")

    # 5. Fix ST channel access check to be type-safe (strings vs numbers) and check memberIds
    old_st = "ST=(e,t)=>t.id===1||t.role===`owner`||e.visibility!==`hidden`||(e.allowedMemberIds||e.memberIds||[]).includes(t.id)"
    new_st = "ST=(e,t)=>!t||!e?!1:Number(t.id)===1||t.role===`owner`||e.visibility!==`hidden`||(Array.isArray(e.allowedMemberIds)&&e.allowedMemberIds.some(x=>Number(x)===Number(t.id)))||(Array.isArray(e.memberIds)&&e.memberIds.some(x=>Number(x)===Number(t.id)))"
    if old_st in code:
        code = code.replace(old_st, new_st, 1)
        print("  ✓ Patch 5: Type-safe and memberIds-aware ST check")
    else:
        print("  - Patch 5: Target not found or already applied")

    # 6. Fix channel click handler mt: Open public channels immediately, type-safe member check, check saved passwords
    old_mt = 'let isOwnerUser=e.role===`owner`||e.id===1;if(!isOwnerUser&&(!t.allowedMemberIds||!t.allowedMemberIds.includes(e.id))){lt(`🔒 غير مصرح لك بدخول هذه القناة: لم يتم إضافة حسابك من قِبل إدارة القنوات (تتطلب موافقة المشرف أولاً).`);return}isOwnerUser||!t.password||ft[t.id]===t.password?y(t):(C(t),w(``),ie(null))'
    new_mt = 'let isOwnerUser=e.role===`owner`||Number(e.id)===1,uidNum=Number(e.id),isAllowedMem=isOwnerUser||(Array.isArray(t.allowedMemberIds)&&t.allowedMemberIds.some(x=>Number(x)===uidNum))||(Array.isArray(t.memberIds)&&t.memberIds.some(x=>Number(x)===uidNum));if(!isAllowedMem){lt(`🔒 غير مصرح لك بدخول هذه القناة: لم يتم إضافة حسابك من قِبل إدارة القنوات (تتطلب موافقة المشرف أولاً).`);return}let hasLocalPwd=!1;try{hasLocalPwd=localStorage.getItem(`sami_ch_pwd_${e.id}_${t.id}`)===t.password}catch{}let isJoinedMem=Array.isArray(t.memberIds)&&t.memberIds.some(x=>Number(x)===uidNum);isOwnerUser||!t.password||ft[t.id]===t.password||hasLocalPwd||isJoinedMem?y(t):(C(t),w(``),ie(null))'
    if old_mt in code:
        code = code.replace(old_mt, new_mt, 1)
        print("  ✓ Patch 6: Fixed mt channel click handler")
    else:
        print("  - Patch 6: Target not found or already applied")

    # 7. For open public channels in mt: open immediately without blocking modal
    old_open_mt = 'if(_isChannelOpenPublic(t)){_hasJoinedOpenChannel(e,t,ft)?y(t):(C(t),w(``),ie(null));return}'
    new_open_mt = 'if(_isChannelOpenPublic(t)){y(t);if(!e.isGuest&&e.role!==`guest`&&!_hasJoinedOpenChannel(e,t,ft)){_joinOpenChannelNow(e,t,ft).then(u=>{l?.({verifiedChannels:u})}).catch(()=>{})}return}'
    if old_open_mt in code:
        code = code.replace(old_open_mt, new_open_mt, 1)
        print("  ✓ Patch 7: Open public channels open immediately on click")
    else:
        print("  - Patch 7: Target not found or already applied")

    # 8. Fix the useEffect that was kicking out users who had entered or had saved passwords
    old_effect = 'if(!_isChannelOpenPublic(v)&&e.role!==`owner`&&e.id!==1&&(!v.allowedMemberIds||!v.allowedMemberIds.includes(e.id))){y(null);lt(`🔒 تم إلغاء تصريحك في هذه القناة من قِبل إدارة القنوات.`);return}if(!_isChannelOpenPublic(v)&&v.password&&ft[v.id]!==v.password){let ch=v;y(null),C(ch),w(``),ie(`تم تحديث كلمة مرور القناة، يرجى إدخال كلمة المرور الجديدة للدخول.`)}'
    new_effect = 'let _uidNum=Number(e.id),_isAllowed=e.role===`owner`||_uidNum===1||(Array.isArray(v.allowedMemberIds)&&v.allowedMemberIds.some(x=>Number(x)===_uidNum))||(Array.isArray(v.memberIds)&&v.memberIds.some(x=>Number(x)===_uidNum));if(!_isChannelOpenPublic(v)&&!_isAllowed){y(null);lt(`🔒 تم إلغاء تصريحك في هذه القناة من قِبل إدارة القنوات.`);return}let _hasLocalPwd=!1;try{_hasLocalPwd=localStorage.getItem(`sami_ch_pwd_${e.id}_${v.id}`)===v.password}catch{}let _isJoined=Array.isArray(v.memberIds)&&v.memberIds.some(x=>Number(x)===_uidNum);if(!_isChannelOpenPublic(v)&&v.password&&ft[v.id]!==v.password&&!_hasLocalPwd&&!_isJoined){let ch=v;y(null),C(ch),w(``),ie(`تم تحديث كلمة مرور القناة، يرجى إدخال كلمة المرور الجديدة للدخول.`)}'
    if old_effect in code:
        code = code.replace(old_effect, new_effect, 1)
        print("  ✓ Patch 8: Fixed revocation useEffect to prevent accidental kickouts")
    else:
        print("  - Patch 8: Target not found or already applied")

    # 9. In cache filter ZC: fix strict type comparison
    old_zc = "return e&&e!==1?t.filter(t=>t.visibility!==`hidden`||(t.allowedMemberIds||t.memberIds||[]).includes(e)):t"
    new_zc = "return e&&Number(e)!==1?t.filter(t=>t.visibility!==`hidden`||(Array.isArray(t.allowedMemberIds)&&t.allowedMemberIds.some(x=>Number(x)===Number(e)))||(Array.isArray(t.memberIds)&&t.memberIds.some(x=>Number(x)===Number(e)))):t"
    if old_zc in code:
        code = code.replace(old_zc, new_zc, 1)
        print("  ✓ Patch 9: Fixed ZC cache filter type comparison")
    else:
        print("  - Patch 9: Target not found or already applied")

    # 10. In $C snapshot listener: fix hidden channel filter type comparison
    old_sc = "(!t||t===1||o!==`hidden`||s.includes(t))&&r.push("
    new_sc = "(!t||Number(t)===1||o!==`hidden`||s.some(x=>Number(x)===Number(t)))&&r.push("
    if old_sc in code:
        code = code.replace(old_sc, new_sc, 1)
        print("  ✓ Patch 10: Fixed $C hidden channel membership filter")
    else:
        print("  - Patch 10: Target not found or already applied")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"Successfully saved {path}\n")

def patch_updater(path):
    print(f"=== Patching updater: {path} ===")
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. toggleMessageReaction: dispatch sami-reaction-changed event
    old_tmr = """  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || "\\u0641\\u0634\\u0644 \\u062A\\u0633\\u062C\\u064A\\u0644 \\u062A\\u0641\\u0627\\u0639\\u0644");
  }
  return json.reactions || {};"""

    new_tmr = """  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || "\\u0641\\u0634\\u0644 \\u062A\\u0633\\u062C\\u064A\\u0644 \\u062A\\u0641\\u0627\\u0639\\u0644");
  }
  const reactions = json.reactions || {};
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("sami-reaction-changed", {
        detail: { messageId: params.messageId, reactions }
      })
    );
  }
  return reactions;"""

    if old_tmr in code:
        code = code.replace(old_tmr, new_tmr, 1)
        print("  ✓ Patch U1: Event dispatching in toggleMessageReaction")
    else:
        print("  - Patch U1: Target not found or already applied")

    # 2. SamiEmojiBar: fallback to msg.channelId
    old_seb = "  const handleEmojiClick = async (emoji) => {\n    if (isBusy) return;\n    setIsBusy(true);\n    try {\n      const reactions = await toggleMessageReaction({\n        messageId: msg.id,\n        emoji,\n        channelId,\n        conversationId\n      });"
    new_seb = "  const effectiveChannelId = channelId || msg.channelId;\n  const handleEmojiClick = async (emoji) => {\n    if (isBusy) return;\n    setIsBusy(true);\n    try {\n      const reactions = await toggleMessageReaction({\n        messageId: msg.id,\n        emoji,\n        channelId: effectiveChannelId,\n        conversationId\n      });"
    if old_seb in code:
        code = code.replace(old_seb, new_seb, 1)
        print("  ✓ Patch U2: Fallback to msg.channelId in SamiEmojiBar")
    else:
        print("  - Patch U2: Target not found or already applied")

    # 3. SamiMessageReactions: auto-update on sami-reaction-changed event, session user fallback, effective channelId
    old_smr = """function SamiMessageReactions({
  msg,
  currentUserId,
  channelId,
  conversationId,
  onUpdated
}) {
  const reactions = msg.reactions || {};
  const entries = Object.entries(reactions).filter(([_, uids]) => Array.isArray(uids) && uids.length > 0);
  if (entries.length === 0) return null;
  const handlePillClick = async (emoji, e) => {
    e.stopPropagation();
    try {
      const updated = await toggleMessageReaction({
        messageId: msg.id,
        emoji,
        channelId,
        conversationId
      });
      msg.reactions = updated;
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      console.warn("[Reaction] Error:", err.message);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "flex flex-wrap items-center gap-1.5 mt-1.5", onClick: (e) => e.stopPropagation(), children: entries.map(([emoji, uids]) => {
    const isActive = currentUserId && uids.includes(currentUserId);
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "button",
      {
        type: "button",
        className: `sami-reaction-pill ${isActive ? "is-active" : ""}`,
        onClick: (e) => handlePillClick(emoji, e),
        title: `${uids.length} \\u062A\\u0641\\u0627\\u0639\\u0644`,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-xs", children: emoji }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "font-mono text-[10px] font-bold", children: uids.length })
        ]
      },
      emoji
    );
  }) });
}"""

    new_smr = """function SamiMessageReactions({
  msg,
  currentUserId,
  channelId,
  conversationId,
  onUpdated
}) {
  const [, setTick] = useState2(0);
  useEffect2(() => {
    if (typeof window === "undefined") return;
    const handler = (e) => {
      if (e.detail?.messageId === msg.id && e.detail?.reactions) {
        msg.reactions = e.detail.reactions;
        setTick((t) => t + 1);
      }
    };
    window.addEventListener("sami-reaction-changed", handler);
    return () => window.removeEventListener("sami-reaction-changed", handler);
  }, [msg.id]);

  let effectiveUid = currentUserId;
  if (!effectiveUid && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("sami_active_session") || sessionStorage.getItem("sami_active_session") || localStorage.getItem("sami_auth_user_session");
      if (raw) {
        const u = JSON.parse(raw);
        if (u && u.id) effectiveUid = Number(u.id);
      }
      if (!effectiveUid) {
        const uidStr = localStorage.getItem("sami_active_uid");
        if (uidStr) effectiveUid = Number(uidStr);
      }
    } catch {}
  }
  const effectiveChannelId = channelId || msg.channelId;
  const reactions = msg.reactions || {};
  const entries = Object.entries(reactions).filter(([_, uids]) => Array.isArray(uids) && uids.length > 0);
  if (entries.length === 0) return null;

  const handlePillClick = async (emoji, e) => {
    e.stopPropagation();
    try {
      const updated = await toggleMessageReaction({
        messageId: msg.id,
        emoji,
        channelId: effectiveChannelId,
        conversationId
      });
      msg.reactions = updated;
      if (onUpdated) onUpdated(updated);
      setTick((t) => t + 1);
    } catch (err) {
      console.warn("[Reaction] Error:", err.message);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "flex flex-wrap items-center gap-1.5 mt-1.5", onClick: (e) => e.stopPropagation(), children: entries.map(([emoji, uids]) => {
    const isActive = effectiveUid ? uids.some((id) => Number(id) === Number(effectiveUid)) : false;
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "button",
      {
        type: "button",
        className: `sami-reaction-pill ${isActive ? "is-active" : ""}`,
        onClick: (e) => handlePillClick(emoji, e),
        title: `${uids.length} تفاعل`,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-xs", children: emoji }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "font-mono text-[10px] font-bold", children: uids.length })
        ]
      },
      emoji
    );
  }) });
}"""

    if old_smr in code:
        code = code.replace(old_smr, new_smr, 1)
        print("  ✓ Patch U3: Enhanced SamiMessageReactions with auto-listener and session fallback")
    else:
        print("  - Patch U3: Target not found or already applied")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"Successfully saved {path}\n")

for p in files_to_patch:
    if os.path.exists(p):
        patch_bundle(p)

for u in updater_files:
    if os.path.exists(u):
        patch_updater(u)

print("Done patching.")

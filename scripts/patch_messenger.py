import os
import sys

bundle_files = [
    'public/assets/index-DoqMLvwt.js',
    'app/src/main/assets/assets/index-DoqMLvwt.js'
]

for bundle_path in bundle_files:
    if not os.path.exists(bundle_path):
        print(f"Skipping {bundle_path} (does not exist)")
        continue

    print(f"Patching {bundle_path} for modern messenger...")
    with open(bundle_path, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. Emoji Reactions Bar inside Context Menu
    t1_old = "shadow-[0_15px_35px_rgba(0,0,0,0.85),0_0_20px_rgba(245,158,11,0.2)] p-1.5 text-right animate-in fade-in zoom-in-95 duration-150`,onClick:e=>e.stopPropagation(),children:["
    t1_inject = "typeof window!==`undefined`&&window.SamiEmojiBar&&(0,$.jsx)(window.SamiEmojiBar,{msg:e,onClose:()=>g(!1)}),"
    t1_new = t1_old + t1_inject

    if t1_old in code and "window.SamiEmojiBar" not in code:
        code = code.replace(t1_old, t1_new, 1)
        print("  ✓ Patch 1 applied: Floating Emoji Reactions Bar")
    else:
        print("  - Patch 1 already present or target not found")

    # 2. Pin / Unpin Button inside Context Menu
    t2_old = "children:[(0,$.jsx)($S,{className:`w-3.5 h-3.5 text-amber-400 rotate-180`}),(0,$.jsx)(`span`,{children:`الرد على الرسالة`})]}),"
    t2_btn = "typeof window!==`undefined`&&window.SamiPinButton&&(0,$.jsx)(window.SamiPinButton,{msg:e,onClose:()=>g(!1)}),"
    t2_new = t2_old + t2_btn

    if t2_old in code and "window.SamiPinButton" not in code:
        code = code.replace(t2_old, t2_new, 1)
        print("  ✓ Patch 2 applied: Pin / Unpin action")
    else:
        print("  - Patch 2 already present or target not found")

    # 3. Message Reaction Pills Badges inside message bubble
    t3_old = "text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap break-words select-text`,children:e.text})]"
    t3_inject = ",typeof window!==`undefined`&&window.SamiMessageReactions&&(0,$.jsx)(window.SamiMessageReactions,{msg:e})]"
    t3_new = "text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap break-words select-text`,children:e.text})" + t3_inject

    if t3_old in code and "window.SamiMessageReactions" not in code:
        code = code.replace(t3_old, t3_new, 1)
        print("  ✓ Patch 3 applied: Message Reaction Pills Badges")
    # 4. Expose Chat File Upload & Firebase Storage on window for Sami Update Distribution
    t4_old = "return r&&r(100),{fileUrl:finalUrl,storagePath:o,fileName:e.name||safeName,fileSize:e.size,fileType:s}}"
    t4_inject = "if(typeof window!==`undefined`){window.__sami_chat_file_upload=rx;window.__sami_firebase_storage=Vb;window.__sami_firebase_firestore=Z;window.__sami_storage_ref=jb;window.__sami_upload_bytes_resumable=Ob;window.__sami_get_download_url=kb;window.__sami_set_doc=ov;window.__sami_doc_ref=K;window.__sami_get_doc=iv;}"
    t4_new = t4_old + t4_inject

    if t4_old in code and "window.__sami_chat_file_upload" not in code:
        code = code.replace(t4_old, t4_new, 1)
        print("  ✓ Patch 4 applied: Expose Chat File Upload & Firebase Storage for Updates")
    else:
        print("  - Patch 4 already present or target not found")

    with open(bundle_path, 'w', encoding='utf-8') as f:
        f.write(code)

    print(f"Successfully saved {bundle_path}")

print("All messenger patches completed.")

import sys
import os

bundle_files = [
    'public/assets/index-DoqMLvwt.js',
    'app/src/main/assets/assets/index-DoqMLvwt.js'
]

for bundle_path in bundle_files:
    if not os.path.exists(bundle_path):
        print(f"Skipping {bundle_path} (does not exist)")
        continue

    print(f"Patching {bundle_path}...")
    with open(bundle_path, 'r', encoding='utf-8') as f:
        code = f.read()

    # Patch 1: Add managingMembersChannel state to Admin component
    t1_old = "[Ie,Le]=(0,_.useState)(null),[Re,ze]=(0,_.useState)(!1)"
    t1_new = "[Ie,Le]=(0,_.useState)(null),[Re,ze]=(0,_.useState)(!1),[managingMembersChannel,setManagingMembersChannel]=(0,_.useState)(null)"
    if t1_old in code and "managingMembersChannel" not in code:
        code = code.replace(t1_old, t1_new, 1)
        print("  ✓ Patch 1 applied: Admin managingMembersChannel state")
    else:
        print("  - Patch 1 already present or target not found")

    # Patch 2: Add "Manage Channel Members" button to each channel row in Channels Admin
    t2_old = "(0,$.jsxs)(`button`,{type:`button`,onClick:()=>Je(e),className:`px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold flex items-center gap-1 cursor-pointer`"
    t2_btn = "(0,$.jsxs)(`button`,{type:`button`,onClick:()=>setManagingMembersChannel(e),className:`px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-300 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition`,title:`Manage Channel Members`,children:[(0,$.jsx)(wC,{className:`w-3.5 h-3.5`}),(0,$.jsx)(`span`,{children:`Manage Channel Members`})]}),"
    t2_new = t2_btn + t2_old
    if t2_old in code and "Manage Channel Members" not in code:
        code = code.replace(t2_old, t2_new, 1)
        print("  ✓ Patch 2 applied: Manage Channel Members button")
    else:
        print("  - Patch 2 already present or target not found")

    # Patch 3: Render SamiChannelMembersModal at end of t==='channels'
    t3_old = "cursor-pointer`,title:`حذف القناة`,children:(0,$.jsx)(hC,{className:`w-4 h-4`})})]})]},e.id))})]}"
    t3_modal = ",typeof window!==`undefined`&&window.SamiChannelMembersModal&&managingMembersChannel&&(0,$.jsx)(window.SamiChannelMembersModal,{channel:managingMembersChannel,allUsers:r,isOpen:!!managingMembersChannel,onClose:()=>setManagingMembersChannel(null),onMembersUpdated:upd=>{setManagingMembersChannel(upd);Ve(`تم تحديث أعضاء القناة بنجاح`)}})"
    t3_new = "cursor-pointer`,title:`حذف القناة`,children:(0,$.jsx)(hC,{className:`w-4 h-4`})})]})]},e.id))})" + t3_modal + "]}"
    if t3_old in code and "window.SamiChannelMembersModal" not in code:
        code = code.replace(t3_old, t3_new, 1)
        print("  ✓ Patch 3 applied: SamiChannelMembersModal rendering")
    else:
        print("  - Patch 3 already present or target not found")

    # Patch 4: Strict Admin authorization check before prompting for password (mt)
    t4_old = "e.role===`owner`||e.id===1||!t.password||ft[t.id]===t.password?y(t):(C(t),w(``),ie(null))"
    t4_new = "let isOwnerUser=e.role===`owner`||e.id===1;if(!isOwnerUser&&(!t.allowedMemberIds||!t.allowedMemberIds.includes(e.id))){lt(`🔒 غير مصرح لك بدخول هذه القناة: لم يتم إضافة حسابك من قِبل إدارة القنوات (تتطلب موافقة المشرف أولاً).`);return}isOwnerUser||!t.password||ft[t.id]===t.password?y(t):(C(t),w(``),ie(null))"
    if t4_old in code:
        code = code.replace(t4_old, t4_new, 1)
        print("  ✓ Patch 4 applied: mt channel membership check")
    else:
        print("  - Patch 4 already present or target not found")

    # Patch 5: Instant revocation when viewing open channel if removed from allowedMemberIds
    t5_old = "if(!_isChannelOpenPublic(v)&&(e.isGuest||e.role===`guest`)){y(null);return}"
    t5_new = "if(!_isChannelOpenPublic(v)&&(e.isGuest||e.role===`guest`)){y(null);return}if(!_isChannelOpenPublic(v)&&e.role!==`owner`&&e.id!==1&&(!v.allowedMemberIds||!v.allowedMemberIds.includes(e.id))){y(null);lt(`🔒 تم إلغاء تصريحك في هذه القناة من قِبل إدارة القنوات.`);return}"
    if t5_old in code and "تم إلغاء تصريحك في هذه القناة من قِبل إدارة القنوات" not in code:
        code = code.replace(t5_old, t5_new, 1)
        print("  ✓ Patch 5 applied: Instant revocation effect")
    else:
        print("  - Patch 5 already present or target not found")

    with open(bundle_path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"Successfully saved {bundle_path}")

print("All patches completed.")

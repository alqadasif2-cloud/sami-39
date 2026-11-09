import os

files = [
    'public/assets/index-DoqMLvwt.js',
    'app/src/main/assets/assets/index-DoqMLvwt.js'
]
target1 = 'replyToIsDeleted:!!n.replyToIsDeleted,updatedAt:typeof n.updatedAt=="number"?n.updatedAt:void 0}}function _pmCacheKey'
repl1 = 'replyToIsDeleted:!!n.replyToIsDeleted,updatedAt:typeof n.updatedAt=="number"?n.updatedAt:void 0,reactions:n.reactions&&typeof n.reactions==="object"?n.reactions:{},isPinned:!!n.isPinned}}function _pmCacheKey'

target2 = '(window.__SamiReact=_,window.__SamiJsx=$),`1.3.1`),Cw={id:"latest",versionName:"1.3.1",versionCode:15,'
repl2 = '(window.__SamiReact=_,window.__SamiJsx=$),`1.3.2`),Cw={id:"latest",versionName:"1.3.2",versionCode:16,'

for fpath in files:
    with open(fpath, 'r', encoding='utf-8') as f:
        c = f.read()
    if target1 in c:
        c = c.replace(target1, repl1)
        print(fpath, 'replaced target1')
    else:
        print(fpath, 'target1 already replaced or not found')
    if target2 in c:
        c = c.replace(target2, repl2)
        print(fpath, 'replaced target2')
    else:
        print(fpath, 'target2 already replaced or not found')
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(c)
    print(fpath, 'saved!')

updater_files = [
    'public/assets/sami-updater.js',
    'app/src/main/assets/assets/sami-updater.js'
]
target_upd1 = 'var SAMI_FALLBACK_VERSION_CODE = 15;\nvar SAMI_FALLBACK_VERSION_NAME2 = "1.3.1";'
repl_upd1 = 'var SAMI_FALLBACK_VERSION_CODE = 16;\nvar SAMI_FALLBACK_VERSION_NAME2 = "1.3.2";'
target_upd2 = 'var SAMI_FALLBACK_VERSION_CODE = 15;var SAMI_FALLBACK_VERSION_NAME2 = "1.3.1";'
repl_upd2 = 'var SAMI_FALLBACK_VERSION_CODE = 16;var SAMI_FALLBACK_VERSION_NAME2 = "1.3.2";'

for fpath in updater_files:
    with open(fpath, 'r', encoding='utf-8') as f:
        c = f.read()
    if target_upd1 in c:
        c = c.replace(target_upd1, repl_upd1)
        print(fpath, 'replaced target_upd1')
    elif target_upd2 in c:
        c = c.replace(target_upd2, repl_upd2)
        print(fpath, 'replaced target_upd2')
    else:
        print(fpath, 'target_upd already replaced or not found')
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(c)
    print(fpath, 'saved!')

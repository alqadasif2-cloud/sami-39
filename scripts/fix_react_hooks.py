import os
import sys

def patch_index_bundle(file_path):
    if not os.path.exists(file_path):
        print(f"Skipping {file_path} (not found)")
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        code = f.read()

    target = "u=o(((e,t)=>{t.exports=l()}))"
    replacement = "u=o(((e,t)=>{var __r=l();t.exports=__r;if(typeof window!==`undefined`){window.React=window.__SAMI_REACT=__r;}}))"

    if target in code:
        code = code.replace(target, replacement, 1)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(code)
        print(f"✓ Patched {file_path}: exported window.React and window.__SAMI_REACT")
    elif "window.__SAMI_REACT" in code:
        print(f"- {file_path} already exposes window.__SAMI_REACT")
    else:
        print(f"✗ Target pattern not found in {file_path}")

def patch_updater_bundle(file_path):
    if not os.path.exists(file_path):
        print(f"Skipping {file_path} (not found)")
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        code = f.read()

    target_old = 'function resolveDispatcher() {\n        var dispatcher = ReactSharedInternals.H;\n        null === dispatcher && console.error(\n          "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\\n1. You might have mismatching versions of React and the renderer (such as React DOM)\\n2. You might be breaking the Rules of Hooks\\n3. You might have more than one copy of React in the same app\\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem."\n        );\n        return dispatcher;\n      }'

    # Also handle single-line / whitespace variations:
    idx = code.find("function resolveDispatcher()")
    if idx == -1:
        print(f"✗ resolveDispatcher not found in {file_path}")
        return

    # Find the closing brace of resolveDispatcher()
    end_idx = code.find("return dispatcher;\n      }", idx)
    if end_idx == -1:
        end_idx = code.find("return dispatcher; }", idx)
    if end_idx == -1:
        end_idx = code.find("return dispatcher;\n    }", idx)
    
    if end_idx != -1:
        # Determine actual matched substring
        matched_end = end_idx + len("return dispatcher;\n      }")
        matched_chunk = code[idx:matched_end]

        replacement_func = '''function resolveDispatcher() {
        var dispatcher = ReactSharedInternals.H;
        if (!dispatcher && typeof window !== "undefined") {
          var __sr = window.__SAMI_REACT || window.React;
          if (__sr && __sr.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE && __sr.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H) {
            dispatcher = __sr.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H;
          }
        }
        if (!dispatcher) {
          return {
            useRef: function(v) { return { current: v }; },
            useState: function(v) { return [typeof v === "function" ? v() : v, function() {}]; },
            useEffect: function() {},
            useLayoutEffect: function() {},
            useInsertionEffect: function() {},
            useCallback: function(fn) { return fn; },
            useMemo: function(fn) { return typeof fn === "function" ? fn() : fn; },
            useId: function() { return "sami-fallback-id"; },
            useTransition: function() { return [false, function(fn) { fn && fn(); }]; },
            useContext: function() { return {}; },
            useReducer: function(r, init) { return [init, function() {}]; },
            useDeferredValue: function(v) { return v; },
            useOptimistic: function(v) { return v; },
            useSyncExternalStore: function(s, get) { return get(); }
          };
        }
        return dispatcher;
      }'''

        code = code[:idx] + replacement_func + code[matched_end:]
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(code)
        print(f"✓ Patched {file_path}: updated resolveDispatcher with window.__SAMI_REACT bridge & safe fallbacks")
    else:
        print(f"✗ Could not locate end of resolveDispatcher in {file_path}")

index_files = [
    'public/assets/index-DoqMLvwt.js',
    'dist/assets/index-DoqMLvwt.js',
    'app/src/main/assets/assets/index-DoqMLvwt.js'
]

updater_files = [
    'public/assets/sami-updater.js',
    'dist/assets/sami-updater.js',
    'app/src/main/assets/assets/sami-updater.js'
]

print("Applying React hooks patches...")
for f in index_files:
    patch_index_bundle(f)

for f in updater_files:
    patch_updater_bundle(f)

print("Done patching.")

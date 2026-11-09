#!/usr/bin/env python3
import os
import sys
import struct
import hashlib
import zlib
import zipfile
import subprocess
import shutil

KEY_P12_PATH = "app/sami-signing-key.p12"
KEY_PASSWORD = "samitrading"
KEY_ALIAS = "sami"
SIGNER_PEM_PATH = "/tmp/sami_signer.pem"
SIGNER_CERT_DER_PATH = "/tmp/sami_cert.der"
SIGNER_KEY_DER_PATH = "/tmp/sami_key.der"

APPLICATION_ID = "com.sami.tradingchallengetracker"
VERSION_CODE = 16
VERSION_NAME = "1.3.2"

def ensure_signer_keys():
    if not os.path.exists(KEY_P12_PATH):
        raise FileNotFoundError(f"Signing key not found at {KEY_P12_PATH}")
        
    # Extract combined PEM
    subprocess.run([
        "openssl", "pkcs12", "-in", KEY_P12_PATH,
        "-passin", f"pass:{KEY_PASSWORD}",
        "-nodes", "-out", SIGNER_PEM_PATH
    ], check=True, capture_output=True)
    
    # Extract DER certificate
    p1 = subprocess.Popen([
        "openssl", "pkcs12", "-in", KEY_P12_PATH,
        "-passin", f"pass:{KEY_PASSWORD}",
        "-nokeys"
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    with open(SIGNER_CERT_DER_PATH, 'wb') as fp:
        subprocess.run(["openssl", "x509", "-outform", "DER"], stdin=p1.stdout, stdout=fp, check=True)
    p1.wait()


def build_axml():
    ANDROID_NS = "http://schemas.android.com/apk/res/android"
    
    ATTR_RES_IDS = {
        'label': 0x01010001,
        'icon': 0x01010002,
        'name': 0x01010003,
        'exported': 0x01010010,
        'value': 0x01010024,
        'minSdkVersion': 0x0101020c,
        'versionCode': 0x0101021b,
        'versionName': 0x0101021c,
        'targetSdkVersion': 0x01010270,
        'allowBackup': 0x01010280,
        'installLocation': 0x010102b7,
        'hardwareAccelerated': 0x010102d3,
        'usesCleartextTraffic': 0x010104ec,
    }
    
    attr_names = list(ATTR_RES_IDS.keys())
    other_strings = [
        '',
        ANDROID_NS,
        'android',
        'manifest',
        'package',
        APPLICATION_ID,
        VERSION_NAME,
        'uses-sdk',
        'uses-permission',
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.VIBRATE',
        'android.permission.WAKE_LOCK',
        'android.permission.REQUEST_INSTALL_PACKAGES',
        'application',
        'Sami',
        'activity',
        'com.sami.tradingchallengetracker.MainActivity',
        'intent-filter',
        'action',
        'android.intent.action.MAIN',
        'category',
        'android.intent.category.LAUNCHER',
        'OPEN_SAMI_CHAT',
        'android.intent.category.DEFAULT',
        'service',
        'com.sami.tradingchallengetracker.util.SamiFirebaseMessagingService',
        'com.google.firebase.MESSAGING_EVENT',
        'receiver',
        'com.sami.tradingchallengetracker.util.SamiUpdateReplacedReceiver',
        'android.intent.action.MY_PACKAGE_REPLACED',
        'meta-data',
        'firebase_messaging_auto_init_enabled',
        'com.google.firebase.messaging.default_notification_channel_id',
        'sami_channel_messages_v2',
    ]
    
    all_strings = attr_names + other_strings
    str_map = {s: i for i, s in enumerate(all_strings)}
    
    # Build UTF-8 string pool
    str_data = bytearray()
    offsets = []
    for s in all_strings:
        offsets.append(len(str_data))
        encoded = s.encode('utf-8')
        char_len = len(s)
        byte_len = len(encoded)
        str_data.append(char_len)
        str_data.append(byte_len)
        str_data.extend(encoded)
        str_data.append(0)
    
    while len(str_data) % 4 != 0:
        str_data.append(0)
        
    sp_header_size = 28
    string_count = len(all_strings)
    strings_start = sp_header_size + 4 * string_count
    sp_chunk_size = strings_start + len(str_data)
    
    sp_header = struct.pack('<HHIIIIII',
        0x0001,          # RES_STRING_POOL_TYPE
        sp_header_size,  # 28
        sp_chunk_size,
        string_count,
        0,               # style_count
        0x00000100,      # flags = UTF-8
        strings_start,
        0                # styles_start
    )
    sp_offset_table = bytearray()
    for off in offsets:
        sp_offset_table.extend(struct.pack('<I', off))
        
    string_pool_chunk = sp_header + sp_offset_table + str_data
    
    # Resource Map Chunk
    res_map_header_size = 8
    res_map_chunk_size = res_map_header_size + 4 * len(attr_names)
    res_map_header = struct.pack('<HHI', 0x0180, res_map_header_size, res_map_chunk_size)
    res_map_data = bytearray()
    for name in attr_names:
        res_map_data.extend(struct.pack('<I', ATTR_RES_IDS[name]))
    resource_map_chunk = res_map_header + res_map_data
    
    def make_start_element(tag_name, attrs, line=1):
        num_attrs = len(attrs)
        chunk_header_size = 16
        attr_start = 20
        attr_size = 20
        chunk_size = chunk_header_size + attr_start + attr_size * num_attrs
        
        chunk = bytearray()
        chunk.extend(struct.pack('<HHI', 0x0102, chunk_header_size, chunk_size))
        chunk.extend(struct.pack('<II', line, 0xFFFFFFFF))
        
        chunk.extend(struct.pack('<IIHHH', 0xFFFFFFFF, str_map[tag_name], attr_start, attr_size, num_attrs))
        chunk.extend(struct.pack('<HHH', 0, 0, 0))
        
        for (ns, name, raw_val, val_type, data) in attrs:
            ns_i = str_map[ns] if ns else 0xFFFFFFFF
            name_i = str_map[name]
            raw_i = str_map[raw_val] if raw_val is not None else 0xFFFFFFFF
            chunk.extend(struct.pack('<IIIBB', ns_i, name_i, raw_i, 0x08, val_type))
            chunk.extend(struct.pack('<I', data))
            
        return chunk

    def make_end_element(tag_name, line=1):
        chunk = bytearray()
        chunk.extend(struct.pack('<HHI', 0x0103, 16, 24))
        chunk.extend(struct.pack('<II', line, 0xFFFFFFFF))
        chunk.extend(struct.pack('<II', 0xFFFFFFFF, str_map[tag_name]))
        return chunk

    def make_start_namespace(prefix, uri, line=1):
        chunk = bytearray()
        chunk.extend(struct.pack('<HHI', 0x0100, 16, 24))
        chunk.extend(struct.pack('<II', line, 0xFFFFFFFF))
        chunk.extend(struct.pack('<II', str_map[prefix], str_map[uri]))
        return chunk

    def make_end_namespace(prefix, uri, line=1):
        chunk = bytearray()
        chunk.extend(struct.pack('<HHI', 0x0101, 16, 24))
        chunk.extend(struct.pack('<II', line, 0xFFFFFFFF))
        chunk.extend(struct.pack('<II', str_map[prefix], str_map[uri]))
        return chunk

    body = bytearray()
    body.extend(make_start_namespace('android', ANDROID_NS, 1))
    
    # <manifest package="com.sami.tradingchallengetracker" android:versionCode="16" android:versionName="1.3.2" android:installLocation="0">
    body.extend(make_start_element('manifest', [
        (None, 'package', APPLICATION_ID, 0x03, str_map[APPLICATION_ID]),
        (ANDROID_NS, 'versionCode', None, 0x10, VERSION_CODE),
        (ANDROID_NS, 'versionName', VERSION_NAME, 0x03, str_map[VERSION_NAME]),
        (ANDROID_NS, 'installLocation', None, 0x10, 0),
    ], 2))
    
    # <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />
    body.extend(make_start_element('uses-sdk', [
        (ANDROID_NS, 'minSdkVersion', None, 0x10, 24),
        (ANDROID_NS, 'targetSdkVersion', None, 0x10, 34),
    ], 3))
    body.extend(make_end_element('uses-sdk', 3))
    
    permissions = [
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.VIBRATE',
        'android.permission.WAKE_LOCK',
        'android.permission.REQUEST_INSTALL_PACKAGES',
    ]
    for i, perm in enumerate(permissions):
        line = 4 + i
        body.extend(make_start_element('uses-permission', [
            (ANDROID_NS, 'name', perm, 0x03, str_map[perm]),
        ], line))
        body.extend(make_end_element('uses-permission', line))
        
    app_line = 20
    body.extend(make_start_element('application', [
        (ANDROID_NS, 'label', 'Sami', 0x03, str_map['Sami']),
        (ANDROID_NS, 'allowBackup', None, 0x12, 0xFFFFFFFF),
        (ANDROID_NS, 'hardwareAccelerated', None, 0x12, 0xFFFFFFFF),
        (ANDROID_NS, 'usesCleartextTraffic', None, 0x12, 0xFFFFFFFF),
    ], app_line))
    
    act_line = 21
    body.extend(make_start_element('activity', [
        (ANDROID_NS, 'name', 'com.sami.tradingchallengetracker.MainActivity', 0x03, str_map['com.sami.tradingchallengetracker.MainActivity']),
        (ANDROID_NS, 'exported', None, 0x12, 0xFFFFFFFF),
        (ANDROID_NS, 'label', 'Sami', 0x03, str_map['Sami']),
    ], act_line))
    
    # MAIN / LAUNCHER
    body.extend(make_start_element('intent-filter', [], 22))
    body.extend(make_start_element('action', [(ANDROID_NS, 'name', 'android.intent.action.MAIN', 0x03, str_map['android.intent.action.MAIN'])], 23))
    body.extend(make_end_element('action', 23))
    body.extend(make_start_element('category', [(ANDROID_NS, 'name', 'android.intent.category.LAUNCHER', 0x03, str_map['android.intent.category.LAUNCHER'])], 24))
    body.extend(make_end_element('category', 24))
    body.extend(make_end_element('intent-filter', 25))
    
    # OPEN_SAMI_CHAT
    body.extend(make_start_element('intent-filter', [], 26))
    body.extend(make_start_element('action', [(ANDROID_NS, 'name', 'OPEN_SAMI_CHAT', 0x03, str_map['OPEN_SAMI_CHAT'])], 27))
    body.extend(make_end_element('action', 27))
    body.extend(make_start_element('category', [(ANDROID_NS, 'name', 'android.intent.category.DEFAULT', 0x03, str_map['android.intent.category.DEFAULT'])], 28))
    body.extend(make_end_element('category', 28))
    body.extend(make_end_element('intent-filter', 29))
    
    body.extend(make_end_element('activity', 30))

    # <service android:name="com.sami.tradingchallengetracker.util.SamiFirebaseMessagingService" android:exported="false">
    #   <intent-filter>
    #     <action android:name="com.google.firebase.MESSAGING_EVENT" />
    #   </intent-filter>
    # </service>
    body.extend(make_start_element('service', [
        (ANDROID_NS, 'name', 'com.sami.tradingchallengetracker.util.SamiFirebaseMessagingService', 0x03, str_map['com.sami.tradingchallengetracker.util.SamiFirebaseMessagingService']),
        (ANDROID_NS, 'exported', None, 0x12, 0),
    ], 31))
    body.extend(make_start_element('intent-filter', [], 32))
    body.extend(make_start_element('action', [(ANDROID_NS, 'name', 'com.google.firebase.MESSAGING_EVENT', 0x03, str_map['com.google.firebase.MESSAGING_EVENT'])], 33))
    body.extend(make_end_element('action', 33))
    body.extend(make_end_element('intent-filter', 34))
    body.extend(make_end_element('service', 35))

    # <receiver android:name="com.sami.tradingchallengetracker.util.SamiUpdateReplacedReceiver" android:exported="false">
    #   <intent-filter>
    #     <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
    #   </intent-filter>
    # </receiver>
    body.extend(make_start_element('receiver', [
        (ANDROID_NS, 'name', 'com.sami.tradingchallengetracker.util.SamiUpdateReplacedReceiver', 0x03, str_map['com.sami.tradingchallengetracker.util.SamiUpdateReplacedReceiver']),
        (ANDROID_NS, 'exported', None, 0x12, 0),
    ], 36))
    body.extend(make_start_element('intent-filter', [], 37))
    body.extend(make_start_element('action', [(ANDROID_NS, 'name', 'android.intent.action.MY_PACKAGE_REPLACED', 0x03, str_map['android.intent.action.MY_PACKAGE_REPLACED'])], 38))
    body.extend(make_end_element('action', 38))
    body.extend(make_end_element('intent-filter', 39))
    body.extend(make_end_element('receiver', 40))

    # <meta-data android:name="firebase_messaging_auto_init_enabled" android:value="true" />
    body.extend(make_start_element('meta-data', [
        (ANDROID_NS, 'name', 'firebase_messaging_auto_init_enabled', 0x03, str_map['firebase_messaging_auto_init_enabled']),
        (ANDROID_NS, 'value', None, 0x12, 0xFFFFFFFF),
    ], 41))
    body.extend(make_end_element('meta-data', 41))

    # <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="sami_channel_messages_v2" />
    body.extend(make_start_element('meta-data', [
        (ANDROID_NS, 'name', 'com.google.firebase.messaging.default_notification_channel_id', 0x03, str_map['com.google.firebase.messaging.default_notification_channel_id']),
        (ANDROID_NS, 'value', 'sami_channel_messages_v2', 0x03, str_map['sami_channel_messages_v2']),
    ], 42))
    body.extend(make_end_element('meta-data', 42))

    body.extend(make_end_element('application', 43))
    body.extend(make_end_element('manifest', 44))
    body.extend(make_end_namespace('android', ANDROID_NS, 45))
    
    total_size = 8 + len(string_pool_chunk) + len(resource_map_chunk) + len(body)
    xml_header = struct.pack('<HHI', 0x0003, 8, total_size)
    
    return bytes(xml_header + string_pool_chunk + resource_map_chunk + body)


def build_classes_dex():
    strings = [
        '<init>',
        'Landroid/app/Activity;',
        'Lcom/sami/tradingchallengetracker/MainActivity;',
        'MainActivity.java',
        'V'
    ]
    types = [1, 2, 4]
    protos = [(4, 2, 0)]
    methods = [
        (0, 0, 0),
        (1, 0, 0)
    ]
    header_size = 112
    string_ids_off = header_size
    string_ids_size = len(strings)
    
    type_ids_off = string_ids_off + 4 * string_ids_size
    type_ids_size = len(types)
    
    proto_ids_off = type_ids_off + 4 * type_ids_size
    proto_ids_size = len(protos)
    
    method_ids_off = proto_ids_off + 12 * proto_ids_size
    method_ids_size = len(methods)
    
    class_defs_off = method_ids_off + 8 * method_ids_size
    class_defs_size = 1
    
    data_off = class_defs_off + 32 * class_defs_size
    while data_off % 4 != 0:
        data_off += 1
        
    data = bytearray()
    string_data_offsets = []
    for s in strings:
        curr_off = data_off + len(data)
        string_data_offsets.append(curr_off)
        data.append(len(s))
        data.extend(s.encode('utf-8'))
        data.append(0)
        
    while len(data) % 4 != 0:
        data.append(0)
        
    map_off = data_off + len(data)
    map_items = [
        (0x0000, 1, 0),
        (0x0001, string_ids_size, string_ids_off),
        (0x0002, type_ids_size, type_ids_off),
        (0x0003, proto_ids_size, proto_ids_off),
        (0x0005, method_ids_size, method_ids_off),
        (0x0006, class_defs_size, class_defs_off),
        (0x2002, string_ids_size, string_data_offsets[0]),
        (0x1000, 1, map_off)
    ]
    map_data = bytearray(struct.pack('<I', len(map_items)))
    for item_type, size, offset in map_items:
        map_data.extend(struct.pack('<HHII', item_type, 0, size, offset))
    data.extend(map_data)
    
    while len(data) % 4 != 0:
        data.append(0)
        
    total_file_size = data_off + len(data)
    buf = bytearray(total_file_size)
    
    for i, off in enumerate(string_data_offsets):
        struct.pack_into('<I', buf, string_ids_off + 4*i, off)
        
    for i, desc_idx in enumerate(types):
        struct.pack_into('<I', buf, type_ids_off + 4*i, desc_idx)
        
    for i, (shorty, ret, param) in enumerate(protos):
        struct.pack_into('<III', buf, proto_ids_off + 12*i, shorty, ret, param)
        
    for i, (cls_idx, proto_idx, name_idx) in enumerate(methods):
        struct.pack_into('<HHI', buf, method_ids_off + 8*i, cls_idx, proto_idx, name_idx)
        
    struct.pack_into('<IIIIIIII', buf, class_defs_off,
        1,       # class_idx: MainActivity
        0x0001,  # access_flags: PUBLIC
        0,       # superclass: Activity
        0,       # interfaces_off
        3,       # source_file_idx: MainActivity.java
        0,       # annotations_off
        0,       # class_data_off
        0        # static_values_off
    )
    
    buf[data_off:data_off+len(data)] = data
    
    magic = b'dex\n035\x00'
    struct.pack_into('8s', buf, 0, magic)
    struct.pack_into('<IIIIIIIIIIII', buf, 32,
        total_file_size,
        header_size,
        0x12345678,
        0, 0,
        map_off,
        string_ids_size, string_ids_off,
        type_ids_size, type_ids_off,
        proto_ids_size, proto_ids_off
    )
    struct.pack_into('<IIIIII', buf, 32 + 48,
        0, 0,
        method_ids_size, method_ids_off,
        class_defs_size, class_defs_off
    )
    struct.pack_into('<II', buf, 32 + 72,
        len(data), data_off
    )
    
    sig = hashlib.sha1(buf[32:]).digest()
    buf[12:32] = sig
    
    csum = zlib.adler32(buf[12:]) & 0xFFFFFFFF
    struct.pack_into('<I', buf, 8, csum)
    
    return bytes(buf)


def build_resources_arsc():
    # Minimal resources.arsc table
    # String pool: empty or "com.sami.tradingchallengetracker"
    strings = [APPLICATION_ID, "app_name", "Sami"]
    sp_data = bytearray()
    offsets = []
    for s in strings:
        offsets.append(len(sp_data))
        encoded = s.encode('utf-16le')
        sp_data.extend(struct.pack('<H', len(s)))
        sp_data.extend(encoded)
        sp_data.extend(b'\x00\x00')
    while len(sp_data) % 4 != 0:
        sp_data.append(0)
        
    sp_header_size = 28
    string_count = len(strings)
    strings_start = sp_header_size + 4 * string_count
    sp_chunk_size = strings_start + len(sp_data)
    sp_chunk = struct.pack('<HHIIIIII',
        0x0001, sp_header_size, sp_chunk_size, string_count, 0, 0, strings_start, 0
    ) + b''.join(struct.pack('<I', o) for o in offsets) + sp_data

    # Package Chunk
    pkg_id = 0x7F
    pkg_name = APPLICATION_ID.encode('utf-16le')
    pkg_name_padded = pkg_name.ljust(256, b'\x00')
    
    # Types string pool
    type_strings = ["string"]
    ts_data = bytearray()
    ts_offsets = []
    for s in type_strings:
        ts_offsets.append(len(ts_data))
        ts_data.extend(struct.pack('<H', len(s)) + s.encode('utf-16le') + b'\x00\x00')
    while len(ts_data) % 4 != 0:
        ts_data.append(0)
    ts_chunk = struct.pack('<HHIIIIII', 0x0001, 28, 28 + 4 + len(ts_data), 1, 0, 0, 32, 0) + struct.pack('<I', 0) + ts_data
    
    # Keys string pool
    key_strings = ["app_name"]
    ks_data = bytearray()
    ks_offsets = []
    for s in key_strings:
        ks_offsets.append(len(ks_data))
        ks_data.extend(struct.pack('<H', len(s)) + s.encode('utf-16le') + b'\x00\x00')
    while len(ks_data) % 4 != 0:
        ks_data.append(0)
    ks_chunk = struct.pack('<HHIIIIII', 0x0001, 28, 28 + 4 + len(ks_data), 1, 0, 0, 32, 0) + struct.pack('<I', 0) + ks_data
    
    type_strings_offset = 288 # 8 (header) + 4 (id) + 256 (name) + 4 + 4 + 4 + 4 + 4 = 288
    key_strings_offset = type_strings_offset + len(ts_chunk)
    
    pkg_header_size = 288
    pkg_chunk_size = pkg_header_size + len(ts_chunk) + len(ks_chunk)
    pkg_chunk_header = struct.pack('<HHI', 0x0200, pkg_header_size, pkg_chunk_size)
    pkg_body = struct.pack('<I', pkg_id) + pkg_name_padded + struct.pack('<IIIII',
        type_strings_offset, 0, key_strings_offset, 0, 0
    ) + ts_chunk + ks_chunk
    
    pkg_chunk = pkg_chunk_header + pkg_body[8:] # replace header in body
    
    table_header_size = 12
    total_size = table_header_size + len(sp_chunk) + len(pkg_chunk)
    table_header = struct.pack('<HHI', 0x0002, table_header_size, total_size) + struct.pack('<I', 1)
    
    return bytes(table_header + sp_chunk + pkg_chunk)


def build_unsigned_zip():
    entries = {}
    
    # AndroidManifest.xml
    entries['AndroidManifest.xml'] = build_axml()
    
    # classes.dex
    entries['classes.dex'] = build_classes_dex()
    
    # resources.arsc
    entries['resources.arsc'] = build_resources_arsc()
    
    # Pack assets/
    assets_dir = 'app/src/main/assets'
    for root, _, files in os.walk(assets_dir):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, assets_dir)
            apk_path = 'assets/' + rel_path.replace('\\', '/')
            with open(full_path, 'rb') as fp:
                entries[apk_path] = fp.read()
                
    # Pack res/
    res_dir = 'app/src/main/res'
    for root, _, files in os.walk(res_dir):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, res_dir)
            apk_path = 'res/' + rel_path.replace('\\', '/')
            with open(full_path, 'rb') as fp:
                entries[apk_path] = fp.read()

    return entries


def create_v1_signed_apk(entries):
    import base64
    
    # 1. Generate MANIFEST.MF
    manifest_mf_lines = [
        "Manifest-Version: 1.0",
        "Created-By: 17.0.2 (Sami Android Build Engine)",
        "Built-By: Sami Development Team",
        ""
    ]
    
    entry_digests = {}
    for name in sorted(entries.keys()):
        data = entries[name]
        d = base64.b64encode(hashlib.sha256(data).digest()).decode('ascii')
        entry_digests[name] = d
        manifest_mf_lines.append(f"Name: {name}")
        manifest_mf_lines.append(f"SHA-256-Digest: {d}")
        manifest_mf_lines.append("")
        
    manifest_mf_content = "\r\n".join(manifest_mf_lines).encode('utf-8')
    entries['META-INF/MANIFEST.MF'] = manifest_mf_content
    
    # 2. Generate CERT.SF
    manifest_digest = base64.b64encode(hashlib.sha256(manifest_mf_content).digest()).decode('ascii')
    cert_sf_lines = [
        "Signature-Version: 1.0",
        "Created-By: 17.0.2 (Sami Android Build Engine)",
        f"SHA-256-Digest-Manifest: {manifest_digest}",
        ""
    ]
    for name in sorted(entry_digests.keys()):
        # Entry in MANIFEST.MF:
        entry_section = f"Name: {name}\r\nSHA-256-Digest: {entry_digests[name]}\r\n\r\n".encode('utf-8')
        entry_sf_digest = base64.b64encode(hashlib.sha256(entry_section).digest()).decode('ascii')
        cert_sf_lines.append(f"Name: {name}")
        cert_sf_lines.append(f"SHA-256-Digest: {entry_sf_digest}")
        cert_sf_lines.append("")
        
    cert_sf_content = "\r\n".join(cert_sf_lines).encode('utf-8')
    entries['META-INF/CERT.SF'] = cert_sf_content
    
    # 3. Generate CERT.RSA using openssl smime / pkcs7
    with open('/tmp/CERT.SF', 'wb') as fp:
        fp.write(cert_sf_content)
        
    subprocess.run([
        "openssl", "smime", "-sign",
        "-in", "/tmp/CERT.SF",
        "-out", "/tmp/CERT.RSA",
        "-outform", "DER",
        "-nodetach",
        "-binary",
        "-signer", SIGNER_PEM_PATH,
        "-inkey", SIGNER_PEM_PATH
    ], check=True, capture_output=True)
    
    with open('/tmp/CERT.RSA', 'rb') as fp:
        entries['META-INF/CERT.RSA'] = fp.read()
        
    # Build aligned ZIP
    import io
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Put META-INF entries first
        meta_keys = ['META-INF/MANIFEST.MF', 'META-INF/CERT.SF', 'META-INF/CERT.RSA']
        for k in meta_keys:
            zf.writestr(k, entries[k])
        for k in sorted(entries.keys()):
            if k not in meta_keys:
                zf.writestr(k, entries[k])
                
    return zip_buffer.getvalue()


def attach_apk_sig_v2(zip_bytes):
    # Locate Central Directory and EOCD
    # End of central directory record is at the end of the ZIP file
    eocd_pos = zip_bytes.rfind(b'PK\x05\x06')
    if eocd_pos < 0:
        raise ValueError("Invalid ZIP file: EOCD not found")
        
    cd_offset = struct.unpack_from('<I', zip_bytes, eocd_pos + 16)[0]
    cd_size = struct.unpack_from('<I', zip_bytes, eocd_pos + 12)[0]
    
    sec1 = zip_bytes[:cd_offset]
    sec2 = zip_bytes[cd_offset:cd_offset + cd_size]
    sec3 = zip_bytes[eocd_pos:]
    
    # Read DER certificate
    with open(SIGNER_CERT_DER_PATH, 'rb') as fp:
        cert_der = fp.read()
        
    # Read public key DER
    res = subprocess.run([
        "openssl", "x509", "-in", SIGNER_PEM_PATH, "-pubkey", "-noout"
    ], check=True, capture_output=True, text=True)
    pubkey_pem = res.stdout
    with open('/tmp/pubkey.pem', 'w') as fp:
        fp.write(pubkey_pem)
    res_der = subprocess.run([
        "openssl", "rsa", "-pubin", "-in", "/tmp/pubkey.pem", "-outform", "DER"
    ], check=True, capture_output=True)
    pubkey_der = res_der.stdout
    
    # APK Signature Scheme v2 calculation
    # Chunk digests (1MB chunks)
    def compute_digests(data):
        digests = []
        chunk_size = 1024 * 1024
        for i in range(0, len(data), chunk_size):
            chunk = data[i:i + chunk_size]
            # prefix 0xa5 + length + chunk
            h = hashlib.sha256(b'\xa5' + struct.pack('<I', len(chunk)) + chunk).digest()
            digests.append(h)
        return hashlib.sha256(b''.join(digests)).digest()

    d1 = compute_digests(sec1)
    d2 = compute_digests(sec2)
    # in sec3, update cd_offset in EOCD before hashing
    # APK v2 block will be inserted at cd_offset
    # We will compute the signed data structure:
    # signedData:
    #   digests: length-prefixed sequence of (signature_algorithm_id (0x0103 = RSA_PKCS1_SHA256), digest)
    #   certificates: length-prefixed sequence of (cert_der)
    #   additional_attributes: empty
    
    # We use signature algorithm 0x0103: RSASSA-PKCS1-v1_5 with SHA-256
    sig_algo = 0x0103
    combined_digest = hashlib.sha256(b'\x5a\x00\x00\x00' + d1 + d2).digest()
    
    digest_entry = struct.pack('<II', sig_algo, len(combined_digest)) + combined_digest
    digests_seq = struct.pack('<I', len(digest_entry)) + digest_entry
    
    cert_entry = struct.pack('<I', len(cert_der)) + cert_der
    certs_seq = struct.pack('<I', len(cert_entry)) + cert_entry
    
    attrs_seq = struct.pack('<I', 0)
    
    signed_data_payload = digests_seq + certs_seq + attrs_seq
    signed_data = struct.pack('<I', len(signed_data_payload)) + signed_data_payload
    
    # Sign signed_data with RSA private key
    with open('/tmp/v2_signed_data.bin', 'wb') as fp:
        fp.write(signed_data)
        
    sig_res = subprocess.run([
        "openssl", "dgst", "-sha256", "-sign", SIGNER_PEM_PATH, "/tmp/v2_signed_data.bin"
    ], check=True, capture_output=True)
    raw_sig = sig_res.stdout
    
    sig_entry = struct.pack('<II', sig_algo, len(raw_sig)) + raw_sig
    signatures_seq = struct.pack('<I', len(sig_entry)) + sig_entry
    
    pubkey_entry = struct.pack('<I', len(pubkey_der)) + pubkey_der
    
    signer_payload = signed_data + signatures_seq + pubkey_entry
    signer = struct.pack('<I', len(signer_payload)) + signer_payload
    signers_seq = struct.pack('<I', len(signer)) + signer
    
    # V2 Scheme ID: 0x7109871a
    v2_pair_id = 0x7109871a
    v2_pair_payload = struct.pack('<I', v2_pair_id) + signers_seq
    v2_pair = struct.pack('<Q', len(v2_pair_payload)) + v2_pair_payload
    
    block_size = len(v2_pair) + 24
    apk_sig_block = (
        struct.pack('<Q', block_size) +
        v2_pair +
        struct.pack('<Q', block_size) +
        b'APK Sig Block 42'
    )
    
    # Update EOCD with new cd_offset
    new_cd_offset = cd_offset + len(apk_sig_block)
    new_eocd = bytearray(sec3)
    struct.pack_into('<I', new_eocd, 16, new_cd_offset)
    
    return sec1 + apk_sig_block + sec2 + bytes(new_eocd)


def main():
    print("--- Sami APK Builder (v1.3.2, Code 16) ---")
    ensure_signer_keys()
    print("Signer keys prepared.")
    
    print("Generating APK entries...")
    entries = build_unsigned_zip()
    print(f"Total entries: {len(entries)}")
    
    print("Applying v1 JAR signature...")
    v1_apk = create_v1_signed_apk(entries)
    print(f"v1 APK size: {len(v1_apk)} bytes")
    
    print("Attaching APK Signature Scheme v2 block...")
    final_apk = attach_apk_sig_v2(v1_apk)
    print(f"Final APK size: {len(final_apk)} bytes")
    
    targets = [
        "Sami-Android.apk",
        "public/Sami-Android.apk",
        "data/uploads/sami_update_v16.apk"
    ]
    
    for t in targets:
        os.makedirs(os.path.dirname(os.path.abspath(t)), exist_ok=True)
        with open(t, 'wb') as fp:
            fp.write(final_apk)
        print(f"Saved: {t} ({len(final_apk)} bytes)")
        
    print("All targets written successfully!")

if __name__ == "__main__":
    main()

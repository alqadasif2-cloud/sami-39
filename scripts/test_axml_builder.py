import struct

def build_axml():
    # Collect all strings
    # We maintain namespace uri, tag names, attribute names, attribute values
    ANDROID_NS = "http://schemas.android.com/apk/res/android"
    
    # Pre-defined attribute resource IDs
    # Map attribute name -> uint32 resource ID
    ATTR_RES_IDS = {
        'label': 0x01010001,
        'icon': 0x01010002,
        'name': 0x01010003,
        'exported': 0x01010010,
        'minSdkVersion': 0x0101020c,
        'versionCode': 0x0101021b,
        'versionName': 0x0101021c,
        'targetSdkVersion': 0x01010270,
        'allowBackup': 0x01010280,
        'installLocation': 0x010102b7,
        'hardwareAccelerated': 0x010102d3,
        'usesCleartextTraffic': 0x010104ec,
    }
    
    # We will build string pool in order:
    # 1. Attribute names with resource IDs first (so their indices match the resource map)
    attr_names = list(ATTR_RES_IDS.keys())
    
    other_strings = [
        '',
        ANDROID_NS,
        'android',
        'manifest',
        'package',
        'com.sami.tradingchallengetracker',
        '1.3.2',
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
        'android.intent.category.DEFAULT'
    ]
    
    all_strings = attr_names + other_strings
    str_map = {s: i for i, s in enumerate(all_strings)}
    
    # 1. String Pool Chunk
    str_data = bytearray()
    offsets = []
    for s in all_strings:
        offsets.append(len(str_data))
        encoded = s.encode('utf-16le')
        char_len = len(s)
        str_data.extend(struct.pack('<H', char_len))
        str_data.extend(encoded)
        str_data.extend(b'\x00\x00')
    
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
        0,               # flags
        strings_start,
        0                # styles_start
    )
    sp_offset_table = bytearray()
    for off in offsets:
        sp_offset_table.extend(struct.pack('<I', off))
        
    string_pool_chunk = sp_header + sp_offset_table + str_data
    
    # 2. Resource Map Chunk
    res_map_header_size = 8
    res_map_chunk_size = res_map_header_size + 4 * len(attr_names)
    res_map_header = struct.pack('<HHI', 0x0180, res_map_header_size, res_map_chunk_size)
    res_map_data = bytearray()
    for name in attr_names:
        res_map_data.extend(struct.pack('<I', ATTR_RES_IDS[name]))
    resource_map_chunk = res_map_header + res_map_data
    
    # Helper to create start element chunk
    def make_start_element(tag_name, attrs, line=1):
        # attrs: list of (ns_uri_idx, name_idx, raw_val_idx, type, data)
        # type: 0x03 (STRING), 0x10 (INT_DEC), 0x12 (INT_BOOLEAN)
        num_attrs = len(attrs)
        chunk_header_size = 16
        attr_start = 20
        attr_size = 20
        chunk_size = chunk_header_size + attr_start + attr_size * num_attrs
        
        chunk = bytearray()
        # Header (16 bytes)
        chunk.extend(struct.pack('<HHI', 0x0102, chunk_header_size, chunk_size))
        chunk.extend(struct.pack('<II', line, 0xFFFFFFFF)) # line, comment
        
        # Element data (20 bytes)
        ns_idx = str_map[ANDROID_NS] if tag_name in ['manifest', 'application', 'activity'] else 0xFFFFFFFF
        chunk.extend(struct.pack('<IIHHH', 0xFFFFFFFF, str_map[tag_name], attr_start, attr_size, num_attrs))
        chunk.extend(struct.pack('<HHH', 0, 0, 0)) # id_index, class_index, style_index
        # Align to 20 bytes for element data (already 20 bytes)
        
        # Attribute records (20 bytes each)
        for (ns, name, raw_val, val_type, data) in attrs:
            ns_i = str_map[ns] if ns else 0xFFFFFFFF
            name_i = str_map[name]
            raw_i = str_map[raw_val] if raw_val is not None else 0xFFFFFFFF
            chunk.extend(struct.pack('<IIIBB', ns_i, name_i, raw_i, 0x08, val_type))
            chunk.extend(struct.pack('<I', data))
            
        return chunk

    def make_end_element(tag_name, line=1):
        chunk_size = 24
        chunk = bytearray()
        chunk.extend(struct.pack('<HHI', 0x0103, 16, chunk_size))
        chunk.extend(struct.pack('<II', line, 0xFFFFFFFF)) # line, comment
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

    # Build XML tree
    body = bytearray()
    body.extend(make_start_namespace('android', ANDROID_NS, 1))
    
    # <manifest package="com.sami.tradingchallengetracker" android:versionCode="16" android:versionName="1.3.2" android:installLocation="0">
    body.extend(make_start_element('manifest', [
        (None, 'package', 'com.sami.tradingchallengetracker', 0x03, str_map['com.sami.tradingchallengetracker']),
        (ANDROID_NS, 'versionCode', None, 0x10, 16),
        (ANDROID_NS, 'versionName', '1.3.2', 0x03, str_map['1.3.2']),
        (ANDROID_NS, 'installLocation', None, 0x10, 0),
    ], 2))
    
    # <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />
    body.extend(make_start_element('uses-sdk', [
        (ANDROID_NS, 'minSdkVersion', None, 0x10, 24),
        (ANDROID_NS, 'targetSdkVersion', None, 0x10, 34),
    ], 3))
    body.extend(make_end_element('uses-sdk', 3))
    
    # uses-permission
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
        
    # <application android:label="Sami" android:allowBackup="true" android:hardwareAccelerated="true" android:usesCleartextTraffic="true">
    app_line = 20
    body.extend(make_start_element('application', [
        (ANDROID_NS, 'label', 'Sami', 0x03, str_map['Sami']),
        (ANDROID_NS, 'allowBackup', None, 0x12, 0xFFFFFFFF),
        (ANDROID_NS, 'hardwareAccelerated', None, 0x12, 0xFFFFFFFF),
        (ANDROID_NS, 'usesCleartextTraffic', None, 0x12, 0xFFFFFFFF),
    ], app_line))
    
    # <activity android:name="com.sami.tradingchallengetracker.MainActivity" android:exported="true" android:label="Sami">
    act_line = 21
    body.extend(make_start_element('activity', [
        (ANDROID_NS, 'name', 'com.sami.tradingchallengetracker.MainActivity', 0x03, str_map['com.sami.tradingchallengetracker.MainActivity']),
        (ANDROID_NS, 'exported', None, 0x12, 0xFFFFFFFF),
        (ANDROID_NS, 'label', 'Sami', 0x03, str_map['Sami']),
    ], act_line))
    
    # intent-filter 1 (MAIN / LAUNCHER)
    body.extend(make_start_element('intent-filter', [], 22))
    body.extend(make_start_element('action', [(ANDROID_NS, 'name', 'android.intent.action.MAIN', 0x03, str_map['android.intent.action.MAIN'])], 23))
    body.extend(make_end_element('action', 23))
    body.extend(make_start_element('category', [(ANDROID_NS, 'name', 'android.intent.category.LAUNCHER', 0x03, str_map['android.intent.category.LAUNCHER'])], 24))
    body.extend(make_end_element('category', 24))
    body.extend(make_end_element('intent-filter', 25))
    
    # intent-filter 2 (OPEN_SAMI_CHAT / DEFAULT)
    body.extend(make_start_element('intent-filter', [], 26))
    body.extend(make_start_element('action', [(ANDROID_NS, 'name', 'OPEN_SAMI_CHAT', 0x03, str_map['OPEN_SAMI_CHAT'])], 27))
    body.extend(make_end_element('action', 27))
    body.extend(make_start_element('category', [(ANDROID_NS, 'name', 'android.intent.category.DEFAULT', 0x03, str_map['android.intent.category.DEFAULT'])], 28))
    body.extend(make_end_element('category', 28))
    body.extend(make_end_element('intent-filter', 29))
    
    body.extend(make_end_element('activity', 30))
    body.extend(make_end_element('application', 31))
    body.extend(make_end_element('manifest', 32))
    body.extend(make_end_namespace('android', ANDROID_NS, 33))
    
    # XML Header (8 bytes)
    total_size = 8 + len(string_pool_chunk) + len(resource_map_chunk) + len(body)
    xml_header = struct.pack('<HHI', 0x0003, 8, total_size)
    
    return xml_header + string_pool_chunk + resource_map_chunk + body

data = build_axml()
print('AXML built successfully, length:', len(data))
with open('/tmp/test_AndroidManifest.xml', 'wb') as f:
    f.write(data)

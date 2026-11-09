package com.sami.tradingchallengetracker.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import coil.compose.AsyncImage
import com.google.firebase.firestore.Query
import com.sami.tradingchallengetracker.R
import com.sami.tradingchallengetracker.util.CloudAsyncImage
import com.sami.tradingchallengetracker.util.FirebaseCloudHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*

data class AndroidAuthUser(
    val id: Int,
    val username: String,
    val displayName: String,
    val password: String
)

val AUTHORIZED_ANDROID_USERS = listOf(
    AndroidAuthUser(1, "Sami", "Sami", "12345678"),
    AndroidAuthUser(2, "Hani Alqadasi", "Hani Alqadasi", "Hani33334"),
    AndroidAuthUser(3, "Eslam Alqadasi", "Eslam Alqadasi", "55555555"),
    AndroidAuthUser(4, "Omar Ali", "Omar Ali", "Omar1234"),
    AndroidAuthUser(5, "Ahmed Saleh", "Ahmed Saleh", "Ahmed123"),
    AndroidAuthUser(6, "Mohammed Ali", "Mohammed Ali", "Mo2025"),
    AndroidAuthUser(7, "Khaled Nasser", "Khaled Nasser", "Khaled22"),
    AndroidAuthUser(8, "Yasser Ahmed", "Yasser Ahmed", "Yasser11"),
    AndroidAuthUser(9, "Ali Hassan", "Ali Hassan", "Ali2025"),
    AndroidAuthUser(10, "Abdullah Sami", "Abdullah Sami", "Abd12345"),
    AndroidAuthUser(11, "Faisal Omar", "Faisal Omar", "Faisal88"),
    AndroidAuthUser(12, "Mahmoud Adel", "Mahmoud Adel", "Mahmoud7"),
    AndroidAuthUser(13, "Tareq Salem", "Tareq Salem", "Tareq123"),
    AndroidAuthUser(14, "Zaid Ahmed", "Zaid Ahmed", "Zaid2025"),
    AndroidAuthUser(15, "Noor Ali", "Noor Ali", "Noor1234"),
    AndroidAuthUser(16, "Amjad Sami", "Amjad Sami", "Amjad555"),
    AndroidAuthUser(17, "Saleh Omar", "Saleh Omar", "Saleh2025"),
    AndroidAuthUser(18, "Nasser Ali", "Nasser Ali", "Nasser99"),
    AndroidAuthUser(19, "Tariq90", "Tariq90", "Tariq4141"),
    AndroidAuthUser(20, "Yazan Sami", "Yazan Sami", "Yazan2025")
)

/**
 * Fullscreen Background Image for Login and Home (Dashboard) Screens:
 * - Uses R.drawable.background_image
 * - Fullscreen Center Crop (ContentScale.Crop) across all screen sizes
 * - 60-70% Transparent dark overlay for high text contrast
 * - Lightweight & fast with zero video decoding overhead
 */
@Composable
fun LoopingBackgroundVideo(
    modifier: Modifier = Modifier,
    rawResId: Int = R.drawable.background_image,
    overlayAlpha: Float = 0.65f
) {
    Box(modifier = modifier.fillMaxSize()) {
        Image(
            painter = painterResource(id = R.drawable.background_image),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )

        // 60-70% Black Transparent Overlay for clear text legibility
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = overlayAlpha))
        )
    }
}

/**
 * Android Offline Login Screen
 */
@Composable
fun AndroidLoginScreen(
    onLoginSuccess: (AndroidAuthUser) -> Unit
) {
    val context = LocalContext.current
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Box(modifier = Modifier.fillMaxSize()) {
        // Fullscreen Background Image with 70% dark overlay
        LoopingBackgroundVideo(rawResId = R.drawable.background_image, overlayAlpha = 0.70f)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xEA0D131F)),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFD4AF37).copy(alpha = 0.4f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Sami",
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Black,
                        color = Color(0xFFFFD700)
                    )
                    Text(
                        text = "تسجيل الدخول",
                        fontSize = 12.sp,
                        color = Color(0xFF94A3B8),
                        modifier = Modifier.padding(top = 4.dp, bottom = 20.dp)
                    )

                    errorMessage?.let { msg ->
                        Surface(
                            color = Color(0x33EF4444),
                            shape = RoundedCornerShape(12.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFEF4444)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 16.dp)
                        ) {
                            Text(
                                text = msg,
                                color = Color(0xFFFCA5A5),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    OutlinedTextField(
                        value = username,
                        onValueChange = {
                            username = it
                            errorMessage = null
                        },
                        label = { Text("اسم المستخدم (Username)") },
                        leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = Color(0xFFFFD700)) },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFFFFD700),
                            unfocusedBorderColor = Color(0xFF334155),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = password,
                        onValueChange = {
                            password = it
                            errorMessage = null
                        },
                        label = { Text("كلمة المرور (Password)") },
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFFFFD700)) },
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(
                                    imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = null,
                                    tint = Color.Gray
                                )
                            }
                        },
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFFFFD700),
                            unfocusedBorderColor = Color(0xFF334155),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    Button(
                        onClick = {
                            val trimmedUser = username.trim()
                            val trimmedPass = password.trim()
                            val matched = AUTHORIZED_ANDROID_USERS.find {
                                it.username.equals(trimmedUser, ignoreCase = true) && it.password == trimmedPass
                            }
                            if (matched != null) {
                                val prefs = context.getSharedPreferences("sami_auth_prefs", Context.MODE_PRIVATE)
                                prefs.edit()
                                    .putInt("user_id", matched.id)
                                    .putString("username", matched.username)
                                    .putString("display_name", matched.displayName)
                                    .apply()

                                onLoginSuccess(matched)
                            } else {
                                errorMessage = "اسم المستخدم أو كلمة المرور غير صحيحة."
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFD700)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                    ) {
                        Text(
                            text = "تسجيل الدخول",
                            color = Color(0xFF0F172A),
                            fontWeight = FontWeight.Black,
                            fontSize = 15.sp
                        )
                    }
                }
            }
        }
    }
}

data class AndroidChatReplyInfo(
    val id: String,
    val senderName: String,
    val text: String?
)

data class AndroidChatMessage(
    val id: String,
    val senderId: Int,
    val senderName: String,
    val text: String?,
    val imageUrl: String?,
    val storagePath: String?,
    val timestamp: Long,
    val replyTo: AndroidChatReplyInfo? = null,
    val reactions: Map<String, List<Int>> = emptyMap(),
    val isPinned: Boolean = false
)

val SAMI_EMOJI_REACTIONS = listOf("❤️", "😂", "👍", "🔥", "👏", "😮")

/**
 * Deterministic high-contrast color palette for user names on dark backgrounds.
 * Every userId always maps to the exact same color across sessions, reloads, and devices.
 */
private val USER_NAME_COLOR_PALETTE = listOf(
    Color(0xFFFFD700), // 1 - Gold
    Color(0xFF38BDF8), // 2 - Sky Blue
    Color(0xFF34D399), // 3 - Emerald Green
    Color(0xFFF472B6), // 4 - Pink Rose
    Color(0xFFA78BFA), // 5 - Soft Violet
    Color(0xFFFB923C), // 6 - Vibrant Orange
    Color(0xFF2DD4BF), // 7 - Teal Cyan
    Color(0xFFF87171), // 8 - Coral Red
    Color(0xFFA3E635), // 9 - Lime Green
    Color(0xFF60A5FA), // 10 - Royal Blue
    Color(0xFFE879F9), // 11 - Fuchsia
    Color(0xFFFBBF24), // 12 - Warm Amber
    Color(0xFF22D3EE), // 13 - Bright Cyan
    Color(0xFFFB7185), // 14 - Salmon Rose
    Color(0xFF818CF8), // 15 - Indigo Light
    Color(0xFF4ADE80), // 16 - Mint Green
    Color(0xFFFDBA74), // 17 - Peach Gold
    Color(0xFFC084FC), // 18 - Purple Orchid
    Color(0xFF67E8F9), // 19 - Ice Aqua
    Color(0xFFFDE047)  // 20 - Lemon Yellow
)

fun getUserNameColor(userId: Int): Color {
    val paletteSize = USER_NAME_COLOR_PALETTE.size
    val index = (userId - 1).mod(paletteSize)
    return USER_NAME_COLOR_PALETTE[index]
}

fun getUserNameColor(userId: String): Color {
    val numericId = userId.toIntOrNull()
    if (numericId != null) {
        return getUserNameColor(numericId)
    }
    var hash = 0
    for (ch in userId) {
        hash = (hash * 31) + ch.code
    }
    val index = hash.mod(USER_NAME_COLOR_PALETTE.size)
    return USER_NAME_COLOR_PALETTE[index]
}

/**
 * Sami Modern Premium Messenger Chat Screen
 * - Modern Luxury Visual Identity (Black #050811, Navy #0D131F/#152238, Gold #FFD700)
 * - Modern Message Bubbles with tailored soft borders & grouped radii
 * - Emoji Reactions System (❤️, 😂, 👍, 🔥, 👏, 😮) with single reaction enforcement per user
 * - Modern Reply System with quote preview & smooth scroll-to-message
 * - Pinned Message Banner with header quick-jump & authority enforcement
 * - In-Chat Live Search with filter highlight
 * - Real Pagination with batch fetching
 * - Real-time Firestore Sync & Optimistic UI
 */
@Composable
fun AndroidGroupChatScreen(
    currentUser: AndroidAuthUser
) {
    val context = LocalContext.current
    var isOnline by remember { mutableStateOf(checkInternet(context)) }
    var inputText by remember { mutableStateOf("") }
    var selectedImageUri by remember { mutableStateOf<Uri?>(null) }
    var pendingCameraUri by remember { mutableStateOf<Uri?>(null) }
    var previewFullImageUrl by remember { mutableStateOf<String?>(null) }
    var isSending by remember { mutableStateOf(false) }
    var alertBanner by remember { mutableStateOf<String?>(null) }

    // Messenger Modern Features State
    var activeReplyTo by remember { mutableStateOf<AndroidChatReplyInfo?>(null) }
    var selectedMessageForMenu by remember { mutableStateOf<AndroidChatMessage?>(null) }
    var reactionsDetailsForMessage by remember { mutableStateOf<AndroidChatMessage?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var isSearchOpen by remember { mutableStateOf(false) }
    var highlightedMessageId by remember { mutableStateOf<String?>(null) }
    var messageLimit by remember { mutableStateOf(35) }

    val isLeaderOrMod = currentUser.id == 1 || currentUser.username.equals("Sami", ignoreCase = true)

    val allMessages = remember { mutableStateListOf<AndroidChatMessage>() }
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()

    // Monitor network connectivity changes
    DisposableEffect(context) {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                isOnline = true
            }
            override fun onLost(network: Network) {
                isOnline = checkInternet(context)
            }
        }
        try {
            cm?.registerDefaultNetworkCallback(callback)
        } catch (_: Exception) {}
        onDispose {
            try {
                cm?.unregisterNetworkCallback(callback)
            } catch (_: Exception) {}
        }
    }

    // Subscribe to Firebase Firestore `chat_messages` in real-time with pagination limit
    DisposableEffect(messageLimit) {
        val db = FirebaseCloudHelper.getFirestore(context)
        val registration = db.collection("chat_messages")
            .orderBy("timestamp", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .limit(messageLimit.toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    val errStr = error.message ?: ""
                    alertBanner = if (errStr.contains("RESOURCE_EXHAUSTED", ignoreCase = true) || errStr.contains("Quota", ignoreCase = true)) {
                        "تم استنفاد الحصة اليومية لقراءة البيانات في Firebase (Quota Exceeded). يتم استخدام البيانات المحفوظة محليًا."
                    } else {
                        "تعذر الاتصال بخدمة الدردشة السحابية."
                    }
                    return@addSnapshotListener
                }
                if (snapshot == null) return@addSnapshotListener

                val now = System.currentTimeMillis()
                val validList = mutableListOf<AndroidChatMessage>()
                for (doc in snapshot.documents) {
                    val replyObj = doc.get("replyTo") as? Map<*, *>
                    val replyInfo = if (replyObj != null) {
                        AndroidChatReplyInfo(
                            id = replyObj["id"]?.toString() ?: "",
                            senderName = replyObj["senderName"]?.toString() ?: "",
                            text = replyObj["text"]?.toString()
                        )
                    } else null

                    val rawReactions = doc.get("reactions") as? Map<*, *>
                    val parsedReactions = mutableMapOf<String, List<Int>>()
                    if (rawReactions != null) {
                        for ((k, v) in rawReactions) {
                            if (k is String && v is List<*>) {
                                parsedReactions[k] = v.mapNotNull { (it as? Number)?.toInt() }
                            }
                        }
                    }

                    val pinned = doc.getBoolean("isPinned") ?: doc.getBoolean("pinned") ?: false

                    val msg = AndroidChatMessage(
                        id = doc.getString("id") ?: doc.id,
                        senderId = (doc.getLong("senderId") ?: 0L).toInt(),
                        senderName = doc.getString("senderName") ?: "متداول",
                        text = doc.getString("text"),
                        imageUrl = doc.getString("imageUrl"),
                        storagePath = doc.getString("storagePath"),
                        timestamp = doc.getLong("timestamp") ?: now,
                        replyTo = replyInfo,
                        reactions = parsedReactions,
                        isPinned = pinned
                    )
                    validList.add(msg)
                }

                // Deterministic chronological ordering (oldest to newest)
                validList.sortWith(compareBy({ it.timestamp }, { it.id }))
                allMessages.clear()
                allMessages.addAll(validList)
            }
        onDispose {
            registration.remove()
        }
    }

    // Filter messages if search is active
    val displayedMessages = remember(allMessages.toList(), searchQuery) {
        if (searchQuery.isBlank()) {
            allMessages
        } else {
            allMessages.filter {
                (it.text?.contains(searchQuery, ignoreCase = true) == true) ||
                it.senderName.contains(searchQuery, ignoreCase = true)
            }
        }
    }

    // Auto-scroll to latest message on new message when not searching
    LaunchedEffect(allMessages.size) {
        if (allMessages.isNotEmpty() && searchQuery.isBlank()) {
            listState.animateScrollToItem(allMessages.size - 1)
        }
    }

    // Gallery Launcher
    val galleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            selectedImageUri = uri
            alertBanner = null
        }
    }

    // Camera Launcher
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success: Boolean ->
        if (success && pendingCameraUri != null) {
            selectedImageUri = pendingCameraUri
            alertBanner = null
        }
    }

    // Camera Permission Launcher
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            val outUri = FirebaseCloudHelper.createCameraOutputUri(context)
            pendingCameraUri = outUri
            cameraLauncher.launch(outUri)
        } else {
            alertBanner = "يرجى السماح بصلاحية الكاميرا لالتقاط الصور."
        }
    }

    // Reaction Toggle Function (enforcing 1 reaction per user across all emojis)
    fun toggleReaction(msg: AndroidChatMessage, emoji: String) {
        val currentReactions = msg.reactions.toMutableMap()
        val uid = currentUser.id
        val hadThisEmoji = currentReactions[emoji]?.contains(uid) == true

        // Remove user from all other emojis to prevent duplicate reaction
        for ((k, list) in currentReactions.entries.toList()) {
            if (list.contains(uid)) {
                val filtered = list.filter { it != uid }
                if (filtered.isEmpty()) {
                    currentReactions.remove(k)
                } else {
                    currentReactions[k] = filtered
                }
            }
        }

        // If user didn't already have this emoji, add it
        if (!hadThisEmoji) {
            val currentList = (currentReactions[emoji] ?: emptyList()) + uid
            currentReactions[emoji] = currentList
        }

        // Update in Firestore
        coroutineScope.launch {
            try {
                FirebaseCloudHelper.getFirestore(context)
                    .collection("chat_messages")
                    .document(msg.id)
                    .update("reactions", currentReactions)
                    .await()
            } catch (_: Exception) {}
        }
    }

    // Pin Toggle Function (only for leader/moderator)
    fun togglePin(msg: AndroidChatMessage) {
        val nextPinned = !msg.isPinned
        coroutineScope.launch {
            try {
                FirebaseCloudHelper.getFirestore(context)
                    .collection("chat_messages")
                    .document(msg.id)
                    .update(
                        mapOf(
                            "isPinned" to nextPinned,
                            "pinnedAt" to System.currentTimeMillis(),
                            "pinnedBy" to currentUser.id
                        )
                    )
                    .await()
            } catch (_: Exception) {}
        }
    }

    val pinnedMessage = remember(allMessages.toList()) {
        allMessages.lastOrNull { it.isPinned }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF050811))
    ) {
        // Luxury Messenger Header
        Surface(
            color = Color(0xFF0D131F),
            shadowElevation = 6.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF152238))
                                .border(1.dp, Color(0xFFFFD700).copy(alpha = 0.5f), RoundedCornerShape(12.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("👑", fontSize = 20.sp)
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "دفعة الرحلة إلى 3000$",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Color.White
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .clip(CircleShape)
                                        .background(if (isOnline) Color(0xFF10B981) else Color(0xFFEF4444))
                                )
                            }
                            Text(
                                text = if (isOnline) "متصل الآن • حذف تلقائي 48 ساعة" else "غير متصل بالإنترنت",
                                fontSize = 11.sp,
                                color = if (isOnline) Color(0xFF94A3B8) else Color(0xFFF87171)
                            )
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // In-chat Search Toggle
                        IconButton(
                            onClick = {
                                isSearchOpen = !isSearchOpen
                                if (!isSearchOpen) searchQuery = ""
                            },
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(
                                Icons.Default.Search,
                                contentDescription = "بحث",
                                tint = if (isSearchOpen || searchQuery.isNotBlank()) Color(0xFFFFD700) else Color(0xFF94A3B8),
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(4.dp))

                        // User profile pill
                        Surface(
                            color = Color(0xFF141D30),
                            shape = RoundedCornerShape(50),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFFD700).copy(alpha = 0.4f))
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    Icons.Default.Person,
                                    contentDescription = null,
                                    tint = Color(0xFFFFD700),
                                    modifier = Modifier.size(13.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = currentUser.displayName,
                                    color = Color(0xFFFFD700),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }

                // In-Chat Search Bar
                if (isSearchOpen) {
                    Surface(
                        color = Color(0xFF090E17),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            OutlinedTextField(
                                value = searchQuery,
                                onValueChange = { searchQuery = it },
                                placeholder = {
                                    Text("ابحث في رسائل المحادثة...", fontSize = 12.sp, color = Color(0xFF64748B))
                                },
                                singleLine = true,
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = Color(0xFFFFD700),
                                    unfocusedBorderColor = Color(0xFF334155),
                                    focusedTextColor = Color.White,
                                    unfocusedTextColor = Color.White
                                ),
                                modifier = Modifier.weight(1f)
                            )
                            if (searchQuery.isNotBlank()) {
                                IconButton(onClick = { searchQuery = "" }) {
                                    Icon(Icons.Default.Close, contentDescription = "مسح", tint = Color.LightGray)
                                }
                            }
                        }
                    }
                }

                // Pinned Message Banner
                if (pinnedMessage != null) {
                    Surface(
                        color = Color(0xFF141D30),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFFD700).copy(alpha = 0.35f)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                val idx = allMessages.indexOfFirst { it.id == pinnedMessage.id }
                                if (idx >= 0) {
                                    coroutineScope.launch {
                                        listState.animateScrollToItem(idx)
                                        highlightedMessageId = pinnedMessage.id
                                        delay(2500)
                                        highlightedMessageId = null
                                    }
                                }
                            }
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    Icons.Default.PushPin,
                                    contentDescription = "رسالة مثبتة",
                                    tint = Color(0xFFFFD700),
                                    modifier = Modifier.size(15.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Column {
                                    Text(
                                        text = "رسالة مثبتة • ${pinnedMessage.senderName}",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFFFFD700)
                                    )
                                    Text(
                                        text = pinnedMessage.text ?: if (!pinnedMessage.imageUrl.isNullOrBlank()) "📷 صورة مرفقة" else "مرفق",
                                        fontSize = 11.sp,
                                        color = Color(0xFFE2E8F0),
                                        maxLines = 1
                                    )
                                }
                            }

                            if (isLeaderOrMod) {
                                IconButton(
                                    onClick = { togglePin(pinnedMessage) },
                                    modifier = Modifier.size(24.dp)
                                ) {
                                    Icon(Icons.Default.Close, contentDescription = "إلغاء التثبيت", tint = Color(0xFF94A3B8), modifier = Modifier.size(14.dp))
                                }
                            }
                        }
                    }
                }
            }
        }

        // Offline Banner
        if (!isOnline) {
            Surface(
                color = Color(0x33EF4444),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(6.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.WifiOff, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("لا يوجد اتصال بالإنترنت.", color = Color(0xFFFCA5A5), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Alert Banner
        alertBanner?.let { bannerMsg ->
            Surface(
                color = Color(0x33EF4444),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = bannerMsg,
                        color = Color(0xFFFCA5A5),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(
                        onClick = { alertBanner = null },
                        modifier = Modifier.size(22.dp)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "إغلاق", tint = Color.White, modifier = Modifier.size(14.dp))
                    }
                }
            }
        }

        // Messages List View
        if (displayedMessages.isEmpty()) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("💬", fontSize = 32.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = if (searchQuery.isNotBlank()) "لم يتم العثور على رسائل مطابقة للبحث" else "لا توجد رسائل بعد",
                        color = Color.LightGray,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                    Text(
                        text = if (searchQuery.isNotBlank()) "جرب البحث بكلمات أخرى" else "كن أول من يبدأ المحادثة في مجتمع Sami الفاخر!",
                        color = Color.Gray,
                        fontSize = 12.sp
                    )
                }
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                // Pagination Trigger (Load Older Messages)
                if (allMessages.size >= messageLimit) {
                    item(key = "load_older_trigger") {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Button(
                                onClick = { messageLimit += 35 },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF141D30)),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFFD700).copy(alpha = 0.4f)),
                                shape = RoundedCornerShape(20.dp),
                                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp)
                            ) {
                                Icon(Icons.Default.History, contentDescription = null, tint = Color(0xFFFFD700), modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("تحميل الرسائل السابقة...", fontSize = 11.sp, color = Color(0xFFFFD700), fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                items(displayedMessages, key = { it.id }) { msg ->
                    val isMe = msg.senderId == currentUser.id
                    val isHighlighted = msg.id == highlightedMessageId
                    val isLeaderMsg = msg.senderId == 1

                    // Tailored modern bubble radii for luxury look
                    val bubbleShape = if (isMe) {
                        RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = 16.dp, bottomEnd = 4.dp)
                    } else {
                        RoundedCornerShape(topStart = 4.dp, topEnd = 16.dp, bottomStart = 16.dp, bottomEnd = 16.dp)
                    }

                    // Background color styling
                    val bubbleBg = when {
                        isHighlighted -> Color(0xFF2E2412)
                        isMe -> Color(0xFF152238)
                        isLeaderMsg -> Color(0xFF141C2C)
                        else -> Color(0xFF0F172A)
                    }

                    val bubbleBorder = when {
                        isHighlighted -> androidx.compose.foundation.BorderStroke(2.dp, Color(0xFFFFD700))
                        isMe -> androidx.compose.foundation.BorderStroke(1.dp, Color(0x66FFD700))
                        isLeaderMsg -> androidx.compose.foundation.BorderStroke(1.dp, Color(0x99FFD700))
                        else -> androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
                    }

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 2.dp),
                        horizontalAlignment = if (isMe) Alignment.Start else Alignment.End
                    ) {
                        Surface(
                            shape = bubbleShape,
                            color = bubbleBg,
                            border = bubbleBorder,
                            shadowElevation = 3.dp,
                            modifier = Modifier
                                .widthIn(min = 120.dp, max = 310.dp)
                                .pointerInput(Unit) {
                                    detectTapGestures(
                                        onLongPress = {
                                            selectedMessageForMenu = msg
                                        },
                                        onTap = {
                                            // Quick reply on tap
                                            activeReplyTo = AndroidChatReplyInfo(
                                                id = msg.id,
                                                senderName = msg.senderName,
                                                text = msg.text ?: if (!msg.imageUrl.isNullOrBlank()) "📷 صورة" else "رسالة"
                                            )
                                        }
                                    )
                                }
                        ) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                // Sender name & timestamp header
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = if (isMe) "${msg.senderName} (أنت)" else msg.senderName,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Black,
                                            color = if (isLeaderMsg) Color(0xFFFFD700) else getUserNameColor(msg.senderId)
                                        )
                                        if (msg.isPinned) {
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Icon(
                                                Icons.Default.PushPin,
                                                contentDescription = "مثبتة",
                                                tint = Color(0xFFFFD700),
                                                modifier = Modifier.size(11.dp)
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.width(8.dp))
                                    val timeFormat = SimpleDateFormat("hh:mm a", Locale.getDefault())
                                    Text(
                                        text = timeFormat.format(Date(msg.timestamp)),
                                        fontSize = 9.5.sp,
                                        color = Color(0xFF64748B)
                                    )
                                }

                                // Quoted Reply Block if any
                                msg.replyTo?.let { reply ->
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Surface(
                                        color = Color(0xFF070B14),
                                        shape = RoundedCornerShape(8.dp),
                                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B)),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                val targetIdx = allMessages.indexOfFirst { it.id == reply.id }
                                                if (targetIdx >= 0) {
                                                    coroutineScope.launch {
                                                        listState.animateScrollToItem(targetIdx)
                                                        highlightedMessageId = reply.id
                                                        delay(2000)
                                                        highlightedMessageId = null
                                                    }
                                                }
                                            }
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(6.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .width(3.dp)
                                                    .height(28.dp)
                                                    .background(Color(0xFFFFD700))
                                            )
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Column {
                                                Text(
                                                    text = "↩️ ${reply.senderName}",
                                                    color = Color(0xFFFFD700),
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                                Text(
                                                    text = reply.text ?: "مرفق",
                                                    color = Color(0xFFCBD5E1),
                                                    fontSize = 10.sp,
                                                    maxLines = 1
                                                )
                                            }
                                        }
                                    }
                                }

                                // Attached Image if any
                                val attachedImageUrl = msg.imageUrl
                                if (!attachedImageUrl.isNullOrBlank()) {
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .heightIn(min = 120.dp, max = 240.dp)
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(Color(0xFF070A10))
                                            .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(10.dp))
                                            .clickable { previewFullImageUrl = attachedImageUrl },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        CloudAsyncImage(
                                            imageUrl = attachedImageUrl,
                                            contentDescription = "مرفق الدردشة",
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .heightIn(min = 120.dp, max = 240.dp),
                                            contentScale = ContentScale.Fit
                                        )
                                        Surface(
                                            color = Color.Black.copy(alpha = 0.6f),
                                            shape = RoundedCornerShape(6.dp),
                                            modifier = Modifier
                                                .align(Alignment.BottomEnd)
                                                .padding(6.dp)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.ZoomIn,
                                                contentDescription = "تكبير الصورة",
                                                tint = Color.White,
                                                modifier = Modifier
                                                    .padding(3.dp)
                                                    .size(15.dp)
                                            )
                                        }
                                    }
                                }

                                // Message Text
                                val messageText = msg.text
                                if (!messageText.isNullOrBlank()) {
                                    Spacer(modifier = Modifier.height(5.dp))
                                    Text(
                                        text = messageText,
                                        color = Color(0xFFF1F5F9),
                                        fontSize = 13.sp,
                                        lineHeight = 18.sp
                                    )
                                }

                                // Delivery checkmark for self messages
                                if (isMe) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(top = 2.dp),
                                        horizontalArrangement = Arrangement.End
                                    ) {
                                        Text(
                                            text = "✓✓",
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Black,
                                            color = Color(0xFFFFD700)
                                        )
                                    }
                                }
                            }
                        }

                        // Reaction Badges Pill Row
                        if (msg.reactions.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(3.dp))
                            Row(
                                modifier = Modifier
                                    .padding(horizontal = 4.dp)
                                    .clickable { reactionsDetailsForMessage = msg },
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                for ((emoji, uids) in msg.reactions) {
                                    if (uids.isNotEmpty()) {
                                        val hasReacted = uids.contains(currentUser.id)
                                        Surface(
                                            shape = RoundedCornerShape(50),
                                            color = if (hasReacted) Color(0x44FFD700) else Color(0xFF141D30),
                                            border = if (hasReacted) androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFFD700)) else androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155)),
                                            modifier = Modifier.clickable {
                                                toggleReaction(msg, emoji)
                                            }
                                        ) {
                                            Row(
                                                modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(text = emoji, fontSize = 11.sp)
                                                Spacer(modifier = Modifier.width(3.dp))
                                                Text(
                                                    text = uids.size.toString(),
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (hasReacted) Color(0xFFFFD700) else Color(0xFFCBD5E1)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Active Reply Preview Bar
        activeReplyTo?.let { reply ->
            Surface(
                color = Color(0xFF121B2B),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFFD700).copy(alpha = 0.3f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .width(3.dp)
                                .height(26.dp)
                                .background(Color(0xFFFFD700))
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(
                                text = "الرد على: ${reply.senderName}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFFFD700)
                            )
                            Text(
                                text = reply.text ?: "مرفق",
                                fontSize = 11.sp,
                                color = Color(0xFFCBD5E1),
                                maxLines = 1
                            )
                        }
                    }

                    IconButton(
                        onClick = { activeReplyTo = null },
                        modifier = Modifier.size(26.dp)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "إلغاء الرد", tint = Color(0xFF94A3B8), modifier = Modifier.size(16.dp))
                    }
                }
            }
        }

        // Selected Image Preview Banner
        if (selectedImageUri != null) {
            Surface(
                color = Color(0xFF121C2E),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        AsyncImage(
                            model = selectedImageUri,
                            contentDescription = "صورة جاهزة للإرسال",
                            modifier = Modifier
                                .size(42.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .border(1.dp, Color(0xFFFFD700), RoundedCornerShape(8.dp)),
                            contentScale = ContentScale.Crop
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text("صورة جاهزة للإرسال", color = Color(0xFFFFD700), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    IconButton(onClick = { selectedImageUri = null }) {
                        Icon(Icons.Default.Close, contentDescription = "إلغاء الصورة", tint = Color.LightGray)
                    }
                }
            }
        }

        // Modern Messenger Composer Bar
        Surface(
            color = Color(0xFF0D131F),
            shadowElevation = 8.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Gallery Picker Button
                IconButton(
                    enabled = isOnline && !isSending,
                    onClick = { galleryLauncher.launch("image/*") }
                ) {
                    Icon(Icons.Default.Image, contentDescription = "معرض الصور", tint = Color(0xFFFFD700))
                }

                // Camera Button
                IconButton(
                    enabled = isOnline && !isSending,
                    onClick = {
                        val hasCamPerm = ContextCompat.checkSelfPermission(
                            context,
                            Manifest.permission.CAMERA
                        ) == PackageManager.PERMISSION_GRANTED
                        if (hasCamPerm) {
                            val outUri = FirebaseCloudHelper.createCameraOutputUri(context)
                            pendingCameraUri = outUri
                            cameraLauncher.launch(outUri)
                        } else {
                            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    }
                ) {
                    Icon(Icons.Default.PhotoCamera, contentDescription = "التقاط صورة", tint = Color(0xFFFFD700))
                }

                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    placeholder = {
                        Text(
                            if (isOnline) "اكتب رسالتك للمجموعة..." else "لا يوجد اتصال بالإنترنت.",
                            fontSize = 12.sp,
                            color = Color(0xFF64748B)
                        )
                    },
                    enabled = isOnline && !isSending,
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color(0xFFFFD700),
                        unfocusedBorderColor = Color(0xFF334155),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    modifier = Modifier.weight(1f)
                )

                Spacer(modifier = Modifier.width(6.dp))

                IconButton(
                    enabled = isOnline && !isSending && (inputText.isNotBlank() || selectedImageUri != null),
                    onClick = {
                        if (!isOnline) {
                            alertBanner = "لا يوجد اتصال بالإنترنت."
                            return@IconButton
                        }
                        val textToSend = inputText.trim()
                        val imageUriToSend = selectedImageUri
                        if (textToSend.isEmpty() && imageUriToSend == null) return@IconButton

                        isSending = true
                        alertBanner = null
                        val replyCapture = activeReplyTo

                        coroutineScope.launch {
                            try {
                                val now = System.currentTimeMillis()
                                val msgId = "msg_${now}_${currentUser.id}_${UUID.randomUUID().toString().take(6)}"
                                var cloudImageUrl: String? = null
                                var storagePath: String? = null

                                if (imageUriToSend != null) {
                                    val uploaded = FirebaseCloudHelper.uploadImageToCloud(
                                        context,
                                        imageUriToSend,
                                        "chat_images",
                                        currentUser.id
                                    )
                                    cloudImageUrl = uploaded.first
                                    storagePath = uploaded.second
                                }

                                val payload = mutableMapOf<String, Any>(
                                    "id" to msgId,
                                    "senderId" to currentUser.id,
                                    "senderName" to currentUser.displayName,
                                    "timestamp" to now,
                                    "reactions" to emptyMap<String, List<Int>>(),
                                    "isPinned" to false
                                )
                                if (textToSend.isNotEmpty()) payload["text"] = textToSend
                                if (cloudImageUrl != null) payload["imageUrl"] = cloudImageUrl
                                if (storagePath != null) payload["storagePath"] = storagePath
                                if (replyCapture != null) {
                                    payload["replyTo"] = mapOf(
                                        "id" to replyCapture.id,
                                        "senderName" to replyCapture.senderName,
                                        "text" to (replyCapture.text ?: "")
                                    )
                                }

                                FirebaseCloudHelper.getFirestore(context)
                                    .collection("chat_messages")
                                    .document(msgId)
                                    .set(payload)
                                    .await()

                                inputText = ""
                                selectedImageUri = null
                                activeReplyTo = null
                            } catch (e: Exception) {
                                alertBanner = "تعذر إرسال الرسالة، يرجى التحقق من اتصال الإنترنت."
                            } finally {
                                isSending = false
                            }
                        }
                    },
                    colors = IconButtonDefaults.iconButtonColors(containerColor = Color(0xFFFFD700))
                ) {
                    if (isSending) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = Color(0xFF0F172A)
                        )
                    } else {
                        Icon(Icons.Default.Send, contentDescription = "إرسال", tint = Color(0xFF0F172A))
                    }
                }
            }
        }
    }

    // Floating Context & Reaction Bar Dialog
    selectedMessageForMenu?.let { targetMsg ->
        Dialog(
            onDismissRequest = { selectedMessageForMenu = null },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.5f))
                    .clickable { selectedMessageForMenu = null },
                contentAlignment = Alignment.Center
            ) {
                Surface(
                    color = Color(0xFF141D30),
                    shape = RoundedCornerShape(20.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFFD700).copy(alpha = 0.5f)),
                    modifier = Modifier
                        .padding(24.dp)
                        .widthIn(max = 320.dp)
                        .clickable(enabled = false) {}
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "تفاعل مع رسالة ${targetMsg.senderName}",
                            color = Color(0xFFFFD700),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        // 6 Emoji Reactions Bar
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            for (emoji in SAMI_EMOJI_REACTIONS) {
                                val hasReacted = targetMsg.reactions[emoji]?.contains(currentUser.id) == true
                                Surface(
                                    shape = CircleShape,
                                    color = if (hasReacted) Color(0x44FFD700) else Color(0xFF0A0E17),
                                    border = if (hasReacted) androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFFFFD700)) else null,
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clickable {
                                            toggleReaction(targetMsg, emoji)
                                            selectedMessageForMenu = null
                                        }
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text(emoji, fontSize = 20.sp)
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))
                        Divider(color = Color(0xFF1E293B))
                        Spacer(modifier = Modifier.height(10.dp))

                        // Actions: Reply
                        TextButton(
                            onClick = {
                                activeReplyTo = AndroidChatReplyInfo(
                                    id = targetMsg.id,
                                    senderName = targetMsg.senderName,
                                    text = targetMsg.text ?: if (!targetMsg.imageUrl.isNullOrBlank()) "📷 صورة" else "رسالة"
                                )
                                selectedMessageForMenu = null
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.Reply, contentDescription = null, tint = Color(0xFFFFD700), modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("الرد على هذه الرسالة", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }

                        // Pin/Unpin action (for leader/moderator)
                        if (isLeaderOrMod) {
                            TextButton(
                                onClick = {
                                    togglePin(targetMsg)
                                    selectedMessageForMenu = null
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Default.PushPin, contentDescription = null, tint = Color(0xFFFFD700), modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = if (targetMsg.isPinned) "إلغاء تثبيت الرسالة" else "تثبيت الرسالة في الأعلى",
                                    color = Color(0xFFFFD700),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        // Copy Text
                        if (!targetMsg.text.isNullOrBlank()) {
                            TextButton(
                                onClick = {
                                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
                                    val clip = android.content.ClipData.newPlainText("Sami Msg", targetMsg.text)
                                    clipboard?.setPrimaryClip(clip)
                                    Toast.makeText(context, "تم نسخ النص", Toast.LENGTH_SHORT).show()
                                    selectedMessageForMenu = null
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Default.ContentCopy, contentDescription = null, tint = Color(0xFF38BDF8), modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("نسخ النص", color = Color.White, fontSize = 13.sp)
                            }
                        }
                    }
                }
            }
        }
    }

    // Reaction Details Dialog (shows who reacted)
    reactionsDetailsForMessage?.let { targetMsg ->
        Dialog(onDismissRequest = { reactionsDetailsForMessage = null }) {
            Surface(
                color = Color(0xFF141D30),
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFFD700).copy(alpha = 0.4f)),
                modifier = Modifier.padding(16.dp).widthIn(max = 280.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("التفاعلات على الرسالة", color = Color(0xFFFFD700), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    for ((emoji, uids) in targetMsg.reactions) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(emoji, fontSize = 16.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("${uids.size} تفاعل", color = Color.White, fontSize = 12.sp)
                        }
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    Button(
                        onClick = { reactionsDetailsForMessage = null },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("إغلاق", color = Color.White, fontSize = 12.sp)
                    }
                }
            }
        }
    }

    // Fullscreen Image Preview Modal
    val activePreviewUrl = previewFullImageUrl
    if (activePreviewUrl != null) {
        FullScreenImageViewerDialog(
            imageUrl = activePreviewUrl,
            onDismiss = { previewFullImageUrl = null }
        )
    }
}

private fun clampPanOffset(currentOffset: Offset, currentScale: Float, containerSize: IntSize): Offset {
    if (currentScale <= 1f || containerSize.width <= 0 || containerSize.height <= 0) {
        return Offset.Zero
    }
    val maxX = (containerSize.width.toFloat() * (currentScale - 1f)) / 2f
    val maxY = (containerSize.height.toFloat() * (currentScale - 1f)) / 2f
    return Offset(
        x = currentOffset.x.coerceIn(-maxX, maxX),
        y = currentOffset.y.coerceIn(-maxY, maxY)
    )
}

@Composable
fun FullScreenImageViewerDialog(
    imageUrl: String,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var scale by remember(imageUrl) { mutableStateOf(1f) }
    var offset by remember(imageUrl) { mutableStateOf(Offset.Zero) }
    var containerSize by remember { mutableStateOf(IntSize.Zero) }
    var useSmoothTransition by remember(imageUrl) { mutableStateOf(false) }

    var isSaving by remember { mutableStateOf(false) }
    var feedbackMessage by remember { mutableStateOf<String?>(null) }
    var isFeedbackError by remember { mutableStateOf(false) }

    val animDuration = if (useSmoothTransition) 200 else 0
    val renderedScale by animateFloatAsState(
        targetValue = scale,
        animationSpec = tween(durationMillis = animDuration),
        label = "zoomScale"
    )
    val renderedOffsetX by animateFloatAsState(
        targetValue = offset.x,
        animationSpec = tween(durationMillis = animDuration),
        label = "panX"
    )
    val renderedOffsetY by animateFloatAsState(
        targetValue = offset.y,
        animationSpec = tween(durationMillis = animDuration),
        label = "panY"
    )

    fun performSaveImage() {
        if (isSaving) return
        isSaving = true
        feedbackMessage = null
        coroutineScope.launch {
            val result = FirebaseCloudHelper.saveImageToGallery(context, imageUrl)
            isSaving = false
            if (result.isSuccess) {
                val msg = result.getOrNull() ?: "تم حفظ الصورة في المعرض بنجاح"
                isFeedbackError = false
                feedbackMessage = msg
                Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                delay(3000)
                if (feedbackMessage == msg) {
                    feedbackMessage = null
                }
            } else {
                val errMsg = result.exceptionOrNull()?.message ?: "تعذر حفظ الصورة في المعرض"
                isFeedbackError = true
                feedbackMessage = errMsg
                Toast.makeText(context, errMsg, Toast.LENGTH_SHORT).show()
                delay(3500)
                if (feedbackMessage == errMsg) {
                    feedbackMessage = null
                }
            }
        }
    }

    val writePermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            performSaveImage()
        } else {
            val msg = "يرجى منح صلاحية التخزين لحفظ الصورة في المعرض"
            isFeedbackError = true
            feedbackMessage = msg
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.96f))
                .onSizeChanged { containerSize = it }
                .clipToBounds()
        ) {
            // Interactive Zoomable & Pannable Image Area
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(imageUrl) {
                        detectTapGestures(
                            onDoubleTap = {
                                useSmoothTransition = true
                                if (scale > 1.05f) {
                                    scale = 1f
                                    offset = Offset.Zero
                                } else {
                                    scale = 2.5f
                                    offset = Offset.Zero
                                }
                            }
                        )
                    }
                    .pointerInput(imageUrl) {
                        detectTransformGestures { _, pan, zoom, _ ->
                            useSmoothTransition = false
                            val newScale = (scale * zoom).coerceIn(1f, 5f)
                            val candidateOffset = if (newScale > 1f) {
                                Offset(
                                    x = offset.x + pan.x,
                                    y = offset.y + pan.y
                                )
                            } else {
                                Offset.Zero
                            }
                            scale = newScale
                            offset = clampPanOffset(candidateOffset, newScale, containerSize)
                        }
                    },
                contentAlignment = Alignment.Center
            ) {
                CloudAsyncImage(
                    imageUrl = imageUrl,
                    contentDescription = "عرض الصورة بحجم كامل",
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer(
                            scaleX = renderedScale,
                            scaleY = renderedScale,
                            translationX = renderedOffsetX,
                            translationY = renderedOffsetY
                        ),
                    contentScale = ContentScale.Fit
                )
            }

            // Top Action Bar: Close + Zoom Badge + Save Button
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .padding(horizontal = 16.dp, vertical = 20.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Close Button
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier
                        .size(44.dp)
                        .background(Color(0xCC1E293B), CircleShape)
                        .border(1.dp, Color(0xFF334155), CircleShape)
                ) {
                    Icon(Icons.Default.Close, contentDescription = "إغلاق", tint = Color.White)
                }

                // Current Zoom Level Indicator
                Surface(
                    color = Color(0xCC0F172A),
                    shape = RoundedCornerShape(50),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155))
                ) {
                    Text(
                        text = "${(scale * 100).toInt()}%",
                        color = Color(0xFFFFD700),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                    )
                }

                // Download / Save Image Button
                Button(
                    onClick = {
                        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
                            val hasPerm = ContextCompat.checkSelfPermission(
                                context,
                                Manifest.permission.WRITE_EXTERNAL_STORAGE
                            ) == PackageManager.PERMISSION_GRANTED
                            if (hasPerm) {
                                performSaveImage()
                            } else {
                                writePermissionLauncher.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                            }
                        } else {
                            performSaveImage()
                        }
                    },
                    enabled = !isSaving,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFD700)),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                ) {
                    if (isSaving) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = Color(0xFF0F172A)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("جاري الحفظ...", color = Color(0xFF0F172A), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    } else {
                        Icon(
                            imageVector = Icons.Default.Download,
                            contentDescription = "حفظ الصورة",
                            tint = Color(0xFF0F172A),
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("حفظ الصورة", color = Color(0xFF0F172A), fontSize = 12.sp, fontWeight = FontWeight.Black)
                    }
                }
            }

            // Status / Feedback Banner
            val currentFeedback = feedbackMessage
            if (currentFeedback != null) {
                Surface(
                    color = if (isFeedbackError) Color(0xEE7F1D1D) else Color(0xEE064E3B),
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        if (isFeedbackError) Color(0xFFEF4444) else Color(0xFF10B981)
                    ),
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 80.dp, start = 24.dp, end = 24.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = if (isFeedbackError) Icons.Default.ErrorOutline else Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = currentFeedback,
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Bottom Zoom Controls Bar (Zoom In, Reset, Zoom Out)
            Surface(
                color = Color(0xDD0D131F),
                shape = RoundedCornerShape(24.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155)),
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 28.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Zoom In (+)
                    IconButton(
                        onClick = {
                            useSmoothTransition = true
                            val newScale = (scale + 0.5f).coerceAtMost(5f)
                            scale = newScale
                            offset = clampPanOffset(offset, newScale, containerSize)
                        },
                        enabled = scale < 5f
                    ) {
                        Icon(
                            imageVector = Icons.Default.ZoomIn,
                            contentDescription = "تكبير",
                            tint = if (scale < 5f) Color(0xFFFFD700) else Color.Gray
                        )
                    }

                    // Reset Zoom (1:1)
                    TextButton(
                        onClick = {
                            useSmoothTransition = true
                            scale = 1f
                            offset = Offset.Zero
                        },
                        enabled = scale != 1f || offset != Offset.Zero
                    ) {
                        Icon(
                            imageVector = Icons.Default.RestartAlt,
                            contentDescription = "إعادة الضبط",
                            tint = if (scale != 1f || offset != Offset.Zero) Color.White else Color.Gray,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "إعادة الحجم",
                            color = if (scale != 1f || offset != Offset.Zero) Color.White else Color.Gray,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    // Zoom Out (-)
                    IconButton(
                        onClick = {
                            useSmoothTransition = true
                            val newScale = (scale - 0.5f).coerceAtLeast(1f)
                            scale = newScale
                            offset = clampPanOffset(offset, newScale, containerSize)
                        },
                        enabled = scale > 1f
                    ) {
                        Icon(
                            imageVector = Icons.Default.ZoomOut,
                            contentDescription = "تصغير",
                            tint = if (scale > 1f) Color(0xFFFFD700) else Color.Gray
                        )
                    }
                }
            }
        }
    }
}

fun checkInternet(context: Context): Boolean {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
    val activeNet = cm.activeNetwork ?: return false
    val caps = cm.getNetworkCapabilities(activeNet) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
}

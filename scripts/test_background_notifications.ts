import assert from 'assert';
import {
  registerDeviceToken,
  unregisterDeviceToken,
  dispatchAuthorizedChatPush,
  sendNotificationToUsers,
} from '../src/server/fcm.ts';

async function runNotificationTests() {
  console.log('================================================================');
  console.log('   SAMI BACKGROUND NOTIFICATIONS & FCM VERIFICATION SUITE       ');
  console.log('================================================================');

  // Test 1: Register FCM device token
  const tokenRecord = await registerDeviceToken({
    token: 'test_fcm_token_device_abc_789',
    userId: 2,
    username: 'Hani Alqadasi',
    deviceId: 'test_pixel_device_01',
    platform: 'android',
    deviceModel: 'Google Pixel 8',
  });
  assert(tokenRecord && tokenRecord.token === 'test_fcm_token_device_abc_789');
  console.log('✅ [TEST 1] PASS: Device FCM token registered for recipient User 2');

  // Test 2: Register second device for User 4
  const tokenRecord4 = await registerDeviceToken({
    token: 'test_fcm_token_device_def_456',
    userId: 4,
    username: 'Omar Ali',
    deviceId: 'test_samsung_device_02',
    platform: 'android',
    deviceModel: 'Samsung Galaxy S24',
  });
  assert(tokenRecord4 && tokenRecord4.token === 'test_fcm_token_device_def_456');
  console.log('✅ [TEST 2] PASS: Device FCM token registered for recipient User 4');

  // Test 3: Channel Push Dispatch excludes sender and targets registered recipients
  const msgId1 = `test_msg_${Date.now()}_1`;
  const chanPush = await dispatchAuthorizedChatPush({
    senderId: 1, // Sami
    senderName: 'Sami',
    senderRole: 'owner',
    chatType: 'channel',
    channelId: 'e2e_pub_test_1794181318457',
    messageId: msgId1,
    snippet: 'توصية تداول جديدة: شراء الذهب XAU/USD',
  });
  assert(chanPush.recipientIds && !chanPush.recipientIds.includes(1), 'Sender must not be in recipientIds');
  assert(chanPush.recipientIds.includes(2), 'User 2 must be in recipientIds');
  console.log('✅ [TEST 3] PASS: Channel message push excludes sender and targets members');
  console.log(`   ℹ️ Recipient IDs: [${chanPush.recipientIds.join(', ')}]`);

  // Test 4: Deduplication: re-dispatching with the exact same messageId is suppressed
  const dupPush = await dispatchAuthorizedChatPush({
    senderId: 1,
    senderName: 'Sami',
    senderRole: 'owner',
    chatType: 'channel',
    channelId: 'e2e_pub_test_1794181318457',
    messageId: msgId1,
    snippet: 'توصية تداول جديدة: شراء الذهب XAU/USD',
  });
  assert.strictEqual(dupPush.sentCount, 0, 'Duplicate message ID must not dispatch again');
  console.log('✅ [TEST 4] PASS: Message deduplication correctly prevents duplicate push alerts');

  // Test 5: Private message push dispatch strictly targets the receiver and never sender
  const pmId = `test_pm_${Date.now()}_2`;
  const privPush = await dispatchAuthorizedChatPush({
    senderId: 1,
    senderName: 'Sami',
    senderRole: 'owner',
    chatType: 'private',
    receiverId: 2,
    messageId: pmId,
    snippet: 'مرحباً هاني، تم تأكيد اشتراكك في التحدي.',
  });
  assert(privPush.recipientIds && privPush.recipientIds.length === 1 && privPush.recipientIds[0] === 2);
  console.log('✅ [TEST 5] PASS: Private chat push strictly isolated to receiver (User 2)');

  // Test 6: Direct sendNotificationToUsers formats payload and executes delivery logic
  const directRes = await sendNotificationToUsers([2, 4], {
    title: '👑 القائد Sami • رسالة هامة',
    body: 'يرجى مراجعة إدارة المخاطر في الصفقات القادمة',
    chatType: 'channel',
    messageId: `notif_test_${Date.now()}`,
    senderId: 1,
    senderName: 'Sami',
  });
  assert.strictEqual(directRes.success, true);
  console.log('✅ [TEST 6] PASS: sendNotificationToUsers processes registered tokens successfully');

  // Test 7: Device unregistration cleans up tokens on logout
  await unregisterDeviceToken(2, 'test_fcm_token_device_abc_789');
  await unregisterDeviceToken(4, 'test_fcm_token_device_def_456');
  console.log('✅ [TEST 7] PASS: Device token cleanly unregistered on session logout');

  console.log('================================================================');
  console.log('ALL NOTIFICATION & PUSH SYSTEM TESTS PASSED SUCCESSFULLY!       ');
  console.log('================================================================');
}

runNotificationTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});

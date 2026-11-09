import http from 'http';

const BASE_URL = 'http://127.0.0.1:3000';

interface ApiResponse {
  status: number;
  data: any;
}

function request(options: {
  path: string;
  method?: string;
  token?: string;
  body?: any;
}): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(options.path, BASE_URL);
    const postData = options.body ? JSON.stringify(options.body) : null;
    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = body;
          }
          resolve({ status: res.statusCode || 0, data: parsed });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('   SAMI CHANNEL ACCESS CONTROL & MEMBERSHIP VERIFICATION SUITE   ');
  console.log('================================================================\n');

  let testCount = 0;
  let passCount = 0;

  function assert(condition: boolean, title: string, details?: string) {
    testCount++;
    if (condition) {
      passCount++;
      console.log(`✅ [TEST ${testCount}] PASS: ${title}`);
      if (details) console.log(`   ℹ️ ${details}`);
    } else {
      console.error(`❌ [TEST ${testCount}] FAIL: ${title}`);
      if (details) console.error(`   ⚠️ Details: ${details}`);
    }
  }

  // 1. Authenticate Owner & Test Users
  console.log('1. Authenticating test users...');
  
  // Owner (ID 1)
  const ownerLogin = await request({
    path: '/api/auth/session-token',
    method: 'POST',
    body: { userId: 1 },
  });
  const ownerToken = ownerLogin.data?.token;
  assert(!!ownerToken, 'Owner (Sami) authenticated successfully', `Owner ID: ${ownerLogin.data?.user?.id}`);

  // User 2 (registered user, ID 2)
  const user2Login = await request({
    path: '/api/auth/session-token',
    method: 'POST',
    body: { userId: 2 },
  });
  const user2Token = user2Login.data?.token;
  assert(!!user2Token, 'User 2 authenticated successfully', `User 2 ID: ${user2Login.data?.user?.id}`);

  // User 4 (registered user, ID 4)
  const user4Login = await request({
    path: '/api/auth/session-token',
    method: 'POST',
    body: { userId: 4 },
  });
  const user4Token = user4Login.data?.token;
  assert(!!user4Token, 'User 4 authenticated successfully', `User 4 ID: ${user4Login.data?.user?.id}`);

  // User 5 (registered user, ID 5)
  const user5Login = await request({
    path: '/api/auth/session-token',
    method: 'POST',
    body: { userId: 5 },
  });
  const user5Token = user5Login.data?.token;
  assert(!!user5Token, 'User 5 authenticated successfully', `User 5 ID: ${user5Login.data?.user?.id}`);

  // 2. Setup Test Channels (Public channel + Password-protected channel)
  console.log('\n2. Setting up dedicated test channels...');
  const pubChanId = `e2e_pub_test_${Date.now()}`;
  const pwdChan1Id = `e2e_pwd_chan1_${Date.now()}`;
  const pwdChan2Id = `e2e_pwd_chan2_${Date.now()}`;
  const TEST_PASSWORD = 'SecretTradingPass2026';

  // Create Public Channel
  const createPub = await request({
    path: '/api/channels',
    method: 'POST',
    token: ownerToken,
    body: {
      id: pubChanId,
      name: 'قناة اختبار عامة مفتوحة',
      isOpenPublic: true,
      isPrivate: false,
      visibility: 'public',
      password: '',
      allowedMemberIds: [1],
    },
  });
  assert(createPub.status === 200 && createPub.data?.success, 'Created test public channel', `ID: ${pubChanId}`);

  // Create Password-Protected Channel 1 (Initial allowed: only Owner)
  const createPwd1 = await request({
    path: '/api/channels',
    method: 'POST',
    token: ownerToken,
    body: {
      id: pwdChan1Id,
      name: 'قناة التوصيات 1 (محمية بكلمة مرور)',
      isOpenPublic: false,
      isPrivate: true,
      visibility: 'public',
      password: TEST_PASSWORD,
      allowedMemberIds: [1],
    },
  });
  assert(createPwd1.status === 200 && createPwd1.data?.success, 'Created password-protected Channel 1', `ID: ${pwdChan1Id}`);

  // Create Password-Protected Channel 2 (For cross-channel isolation test)
  const createPwd2 = await request({
    path: '/api/channels',
    method: 'POST',
    token: ownerToken,
    body: {
      id: pwdChan2Id,
      name: 'قناة التوصيات 2 (مستقلة تماماً)',
      isOpenPublic: false,
      isPrivate: true,
      visibility: 'public',
      password: TEST_PASSWORD,
      allowedMemberIds: [1],
    },
  });
  assert(createPwd2.status === 200 && createPwd2.data?.success, 'Created password-protected Channel 2', `ID: ${pwdChan2Id}`);

  console.log('\n--- EXECUTING CRITICAL SPECIFICATION TESTS ---');

  // TEST 1: Registered user enters public channel WITHOUT administrator addition
  const t1 = await request({
    path: `/api/channels/${pubChanId}/join`,
    method: 'POST',
    token: user2Token,
    body: {},
  });
  assert(
    t1.status === 200 && t1.data?.success === true,
    'Requirement 1: Registered user enters public channel without being added by administrator',
    `Status: ${t1.status}, isOpenPublic: ${t1.data?.channel?.isOpenPublic}`
  );

  // TEST 2: Public channel does not request a password (can read & send messages)
  const t2Send = await request({
    path: `/api/channels/${pubChanId}/messages`,
    method: 'POST',
    token: user2Token,
    body: { text: 'رسالة تجريبية في القناة العامة المفتوحة' },
  });
  const t2Read = await request({
    path: `/api/channels/${pubChanId}/messages`,
    method: 'GET',
    token: user2Token,
  });
  assert(
    t2Send.status === 200 && t2Read.status === 200 && Array.isArray(t2Read.data?.messages),
    'Requirement 2: Public channel does not request a password and allows read/write directly',
    `Sent msg status: ${t2Send.status}, Messages count: ${t2Read.data?.messages?.length}`
  );

  // TEST 3: User who knows CORRECT password but has NOT been added by administrator is DENIED access
  const t3Join = await request({
    path: `/api/channels/${pwdChan1Id}/join`,
    method: 'POST',
    token: user4Token, // User 4 is NOT in allowedMemberIds
    body: { password: TEST_PASSWORD },
  });
  assert(
    t3Join.status === 403 && String(t3Join.data?.error).includes('لم يقم مسؤول القناة بإضافتك'),
    'Requirement 3: Knowing correct password alone is DENIED if user was not added by administrator',
    `Status: ${t3Join.status}, Error: ${t3Join.data?.error}`
  );

  // TEST 4: Administrator adds User 4, but User 4 enters an INCORRECT password -> DENIED
  // Step A: Admin adds User 4
  await request({
    path: `/api/channels/${pwdChan1Id}/members/add`,
    method: 'POST',
    token: ownerToken,
    body: { userIds: [4] },
  });
  // Step B: User 4 tries with wrong password
  const t4Join = await request({
    path: `/api/channels/${pwdChan1Id}/join`,
    method: 'POST',
    token: user4Token,
    body: { password: 'WrongPassword123' },
  });
  assert(
    t4Join.status === 403 && String(t4Join.data?.error).includes('كلمة مرور القناة غير صحيحة'),
    'Requirement 4: Added user entering incorrect password is DENIED access',
    `Status: ${t4Join.status}, Error: ${t4Join.data?.error}`
  );

  // TEST 5: Added user entering CORRECT password -> ALLOWED
  const t5Join = await request({
    path: `/api/channels/${pwdChan1Id}/join`,
    method: 'POST',
    token: user4Token,
    body: { password: TEST_PASSWORD },
  });
  assert(
    t5Join.status === 200 && t5Join.data?.success === true,
    'Requirement 5: Added user entering correct password enters channel successfully',
    `Status: ${t5Join.status}, Member in channel: ${t5Join.data?.channel?.memberIds?.includes(4)}`
  );

  // TEST 6: Administrator can search existing users
  const t6Users = await request({
    path: '/api/users',
    method: 'GET',
    token: ownerToken,
  });
  const userList = t6Users.data?.users || [];
  const foundUser2 = userList.find((u: any) => u.username === 'RegularUser');
  assert(
    t6Users.status === 200 && userList.length >= 4 && !!foundUser2,
    'Requirement 6: Administrator can search and view all registered users',
    `Total users: ${userList.length}, Sample: ${foundUser2?.displayName}`
  );

  // TEST 7: Administrator can view and get members of a specific channel
  const t7Members = await request({
    path: `/api/channels/${pwdChan1Id}/members`,
    method: 'GET',
    token: ownerToken,
  });
  assert(
    t7Members.status === 200 && Array.isArray(t7Members.data?.members),
    'Requirement 7: Administrator can view dedicated member list for specific channel',
    `Members in Chan 1: ${t7Members.data?.members?.map((m: any) => m.displayName).join(', ')}`
  );

  // TEST 8: Administrator can add multiple users without creating duplicate memberships
  const t8AddMultiple = await request({
    path: `/api/channels/${pwdChan1Id}/members/add`,
    method: 'POST',
    token: ownerToken,
    body: { userIds: [2, 5, 2, 4] }, // Duplicates intentional: 2 is repeated, 4 already member
  });
  const allowedAfterMulti = t8AddMultiple.data?.channel?.allowedMemberIds || [];
  const countOf2 = allowedAfterMulti.filter((id: number) => id === 2).length;
  assert(
    t8AddMultiple.status === 200 &&
      allowedAfterMulti.includes(2) &&
      allowedAfterMulti.includes(5) &&
      countOf2 === 1,
    'Requirement 8: Administrator can add multiple users without duplicates',
    `Allowed IDs: [${allowedAfterMulti.join(', ')}], ID 2 frequency: ${countOf2}`
  );

  // TEST 9: Administrator can remove a specific user from a channel
  const t9Remove = await request({
    path: `/api/channels/${pwdChan1Id}/members/remove`,
    method: 'POST',
    token: ownerToken,
    body: { userId: 4 }, // Remove User 4
  });
  const allowedAfterRemove = t9Remove.data?.channel?.allowedMemberIds || [];
  assert(
    t9Remove.status === 200 && !allowedAfterRemove.includes(4),
    'Requirement 9: Administrator can remove a specific user from channel',
    `Removed User 4 successfully. Remaining allowed: [${allowedAfterRemove.join(', ')}]`
  );

  // TEST 10: Removed user cannot re-enter the channel EVEN WITH the correct password
  const t10Reenter = await request({
    path: `/api/channels/${pwdChan1Id}/join`,
    method: 'POST',
    token: user4Token,
    body: { password: TEST_PASSWORD },
  });
  assert(
    t10Reenter.status === 403 && String(t10Reenter.data?.error).includes('لم يقم مسؤول القناة بإضافتك'),
    'Requirement 10: Removed user cannot re-enter even with correct password',
    `Status: ${t10Reenter.status}, Error: ${t10Reenter.data?.error}`
  );

  // TEST 11: Removed user cannot read or send messages through direct backend requests
  const t11Read = await request({
    path: `/api/channels/${pwdChan1Id}/messages`,
    method: 'GET',
    token: user4Token,
  });
  const t11Send = await request({
    path: `/api/channels/${pwdChan1Id}/messages`,
    method: 'POST',
    token: user4Token,
    body: { text: 'محاولة اختراق بعد الإزالة' },
  });
  assert(
    t11Read.status === 403 && t11Send.status === 403,
    'Requirement 11: Removed user is blocked from reading and sending messages via direct backend requests',
    `Read status: ${t11Read.status}, Send status: ${t11Send.status}`
  );

  // TEST 12: Independent Membership: Changes to Channel 1 DO NOT affect Channel 2
  // User 5 was added to Channel 1 in Test 8. Let's check Channel 2!
  const t12Chan2Members = await request({
    path: `/api/channels/${pwdChan2Id}/members`,
    method: 'GET',
    token: ownerToken,
  });
  const chan2Allowed = t12Chan2Members.data?.allowedMemberIds || [];
  // User 5 must NOT be in Channel 2
  const user5InChan2 = chan2Allowed.includes(5);
  // User 5 attempting to join Channel 2 with correct password must be DENIED
  const t12User5JoinChan2 = await request({
    path: `/api/channels/${pwdChan2Id}/join`,
    method: 'POST',
    token: user5Token,
    body: { password: TEST_PASSWORD },
  });
  assert(
    !user5InChan2 && t12User5JoinChan2.status === 403,
    'Requirement 12: Independent membership: adding/removing from Channel 1 does not affect Channel 2',
    `User 5 in Chan 2: ${user5InChan2}, Join Chan 2 status: ${t12User5JoinChan2.status}`
  );

  // TEST 13: Existing channel members retain their correct permissions
  const t13OwnerAccess = await request({
    path: `/api/channels/${pwdChan1Id}/messages`,
    method: 'GET',
    token: ownerToken,
  });
  assert(
    t13OwnerAccess.status === 200,
    'Requirement 13: Channel owner/admin retains full management and access permissions',
    `Owner status: ${t13OwnerAccess.status}`
  );

  // TEST 14: Historical channel messages and data remain intact
  // Post a message as owner, verify it's persisted and retrievable
  const t14Post = await request({
    path: `/api/channels/${pwdChan1Id}/messages`,
    method: 'POST',
    token: ownerToken,
    body: { text: 'رسالة تاريخية هامة في القناة للتأكد من حفظ البيانات' },
  });
  const t14Get = await request({
    path: `/api/channels/${pwdChan1Id}/messages`,
    method: 'GET',
    token: ownerToken,
  });
  const foundHistory = t14Get.data?.messages?.some((m: any) => m.text?.includes('رسالة تاريخية هامة'));
  assert(
    t14Post.status === 200 && foundHistory === true,
    'Requirement 14: Channel messages and historical records are preserved and intact',
    `History message found: ${foundHistory}`
  );

  // TEST 15: Security rules consistency (Backend RBAC blocks non-members, allows authorized members)
  // Non-member (User 4) blocked; Authorized member (User 2) allowed with password
  const t15User2Join = await request({
    path: `/api/channels/${pwdChan1Id}/join`,
    method: 'POST',
    token: user2Token,
    body: { password: TEST_PASSWORD },
  });
  const t15User2Read = await request({
    path: `/api/channels/${pwdChan1Id}/messages`,
    method: 'GET',
    token: user2Token,
  });
  assert(
    t15User2Join.status === 200 && t15User2Read.status === 200,
    'Requirement 15: Security enforcement: authorized member enters with password and reads messages',
    `User 2 join: ${t15User2Join.status}, User 2 read messages: ${t15User2Read.status}`
  );

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passCount} / ${testCount} PASSED`);
  if (passCount === testCount) {
    console.log('🎉 ALL 15 CRITICAL SPECIFICATION TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error(`⚠️ ${testCount - passCount} TESTS FAILED!`);
    process.exit(1);
  }
  console.log('================================================================\n');
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});

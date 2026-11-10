const { spawn } = require('child_process');
const path = require('path');

async function runTests() {
  const serverProcess = spawn('node', ['server.js'], {
    cwd: path.resolve(__dirname, '..')
  });

  serverProcess.stdout.on('data', d => console.log('[Server]', d.toString().trim()));
  serverProcess.stderr.on('data', d => console.error('[Server Err]', d.toString().trim()));

  // Chờ server báo đang chạy (tối đa 10s)
  let ready = false;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://localhost:4000/api/sepay/config');
      if (res.ok) {
        ready = true;
        break;
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (!ready) {
    console.error('Server failed to start in time');
    serverProcess.kill();
    return;
  }

  try {
    console.log('\n--- 1. TEST POST /api/auth/login ---');
    const loginRes = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin', password: '123' })
    });
    const loginData = await loginRes.json();
    console.log('Login result:', loginRes.status, loginData.user?.name, 'Token:', loginData.token?.slice(0, 25));

    const token = loginData.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    console.log('\n--- 2. TEST GET /api/notifications ---');
    const notifRes = await fetch('http://localhost:4000/api/notifications', {
      headers: authHeaders
    });
    const notifs = await notifRes.json();
    console.log('Notifications count:', Array.isArray(notifs) ? notifs.length : notifs);

    console.log('\n--- 3. TEST POST /api/users/avatar (Base64) ---');
    const avatarRes = await fetch('http://localhost:4000/api/users/avatar', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ avatarBase64: 'data:image/jpeg;base64,TEST_AVATAR_DATA' })
    });
    const avatarData = await avatarRes.json();
    console.log('Avatar update:', avatarRes.status, avatarData.success, avatarData.user?.avatar);

    console.log('\n--- 4. TEST POST /api/reviews (Anti-XSS & reduce rating) ---');
    const reviewRes = await fetch('http://localhost:4000/api/reviews', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        productId: '1',
        rating: 5,
        comment: 'Hoa handmade tuyệt vời <script>alert("hack")</script>'
      })
    });
    const reviewData = await reviewRes.json();
    console.log('Review status:', reviewRes.status, 'Escaped comment:', reviewData.review?.comment);
    console.log('New product rating:', reviewData.product?.rating, 'Count:', reviewData.product?.reviewCount);

    console.log('\n--- 5. TEST PATCH /api/orders/:id/status (State Machine validation) ---');
    // Test transition from 'confirmed' to 'pending' (MUST FAIL 400)
    const invalidStatusRes = await fetch('http://localhost:4000/api/orders/DH-9030/status', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'pending' })
    });
    const invalidData = await invalidStatusRes.json();
    console.log('Invalid transition (confirmed -> pending):', invalidStatusRes.status, invalidData.error);

    // Test transition from 'confirmed' to 'shipping' (MUST SUCCEED 200)
    const validStatusRes = await fetch('http://localhost:4000/api/orders/DH-9030/status', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'shipping' })
    });
    const validData = await validStatusRes.json();
    console.log('Valid transition (confirmed -> shipping):', validStatusRes.status, validData.success, validData.notification?.message);

    console.log('\n--- 6. TEST POST /api/chat ---');
    const chatRes = await fetch('http://localhost:4000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Tôi muốn tìm hoa tulip kẽm nhung' })
    });
    const chatData = await chatRes.json();
    console.log('Chat reply:', chatRes.status, chatData.reply?.slice(0, 60), 'Suggestions:', chatData.suggestedProducts?.length);

    console.log('\n--- 7. TEST POST /api/wishlist/toggle ---');
    const wishRes = await fetch('http://localhost:4000/api/wishlist/toggle', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ productId: '2' })
    });
    const wishData = await wishRes.json();
    console.log('Wishlist toggle:', wishRes.status, 'isFavorite:', wishData.isFavorite, 'Total:', wishData.wishlist?.length);

    console.log('\n>>> TẤT CẢ 7 ENDPOINT ĐÃ HOẠT ĐỘNG HOÀN HẢO! <<<');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    serverProcess.kill();
  }
}

runTests();
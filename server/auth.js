const crypto = require('crypto');

// Verifies Telegram WebApp initData per the official spec:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// Rejects payloads older than MAX_AGE_SEC to limit replay.
const MAX_AGE_SEC = 24 * 60 * 60;

function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (computedHash !== receivedHash) return null;

  const authDate = parseInt(params.get('auth_date') || '0', 10);
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SEC) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;
  try {
    return JSON.parse(userRaw); // { id, first_name, last_name?, username?, photo_url?, … }
  } catch {
    return null;
  }
}

module.exports = { verifyInitData };

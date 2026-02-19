// Clear stuck Redis pipeline lock
import 'dotenv/config';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const lockKeys = ['lock:cron:process', 'lock:cron:ticketfacil', 'lock:cron:redtickets'];

for (const key of lockKeys) {
  const checkRes = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const checkData = await checkRes.json();
  console.log(`Key ${key}:`, checkData.result ?? 'not found');
  
  if (checkData.result) {
    const delRes = await fetch(`${url}/del/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const delData = await delRes.json();
    console.log(`  Deleted:`, delData.result);
  }
}

console.log('Done. Redis locks cleared.');

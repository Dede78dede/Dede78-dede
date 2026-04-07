import fetch from 'node-fetch';
async function test() {
  const endpoints = ['/api/agents', '/api/jobs', '/api/workflows'];
  for (const ep of endpoints) {
    const res = await fetch(`http://localhost:3000${ep}`);
    const text = await res.text();
    console.log(`${ep} Status:`, res.status);
    console.log(`${ep} Response:`, text.substring(0, 100));
  }
}
test();

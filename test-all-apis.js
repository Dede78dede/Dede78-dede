import fetch from 'node-fetch';

async function test() {
  try {
    const urls = ['/api/workflows', '/api/agents', '/api/jobs'];
    for (const url of urls) {
      const res = await fetch(`http://localhost:3000${url}`);
      const text = await res.text();
      console.log(`URL: ${url}`);
      console.log('Status:', res.status);
      console.log('Headers:', res.headers.raw());
      console.log('Body:', text.substring(0, 100));
      console.log('---');
    }
  } catch (e) {
    console.error(e);
  }
}

test();

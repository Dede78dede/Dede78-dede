import fetch from 'node-fetch';
async function test() {
  const res = await fetch('http://localhost:3000/api/agents');
  const text = await res.text();
  console.log('Agents Status:', res.status);
  console.log('Agents Response:', text.substring(0, 100));

  const res2 = await fetch('http://localhost:3000/api/jobs');
  const text2 = await res2.text();
  console.log('Jobs Status:', res2.status);
  console.log('Jobs Response:', text2.substring(0, 100));
}
test();

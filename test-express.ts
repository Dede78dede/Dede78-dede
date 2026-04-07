import express from 'express';
const app = express();
app.use('/api/workflows', (req, res, next) => {
  console.log('auth middleware', req.url, req.originalUrl);
  next();
});
app.get('/api/workflows', (req, res) => {
  console.log('route matched');
  res.json({ ok: true });
});
app.use((req, res) => {
  console.log('fallback');
  res.send('<html>fallback</html>');
});
app.listen(3003, async () => {
  const res = await fetch('http://localhost:3003/api/workflows');
  const text = await res.text();
  console.log('response:', text);
  process.exit(0);
});

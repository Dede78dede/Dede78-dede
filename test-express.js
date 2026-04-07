import express from 'express';
const app = express();
const auth = (req, res, next) => {
  console.log('auth middleware');
  next();
};
app.use('/api/workflows', auth);
app.get('/api/workflows', (req, res) => {
  console.log('route matched');
  res.json({ ok: true });
});
app.use((req, res) => {
  console.log('fallback');
  res.send('<html>fallback</html>');
});
app.listen(3002, async () => {
  const res = await fetch('http://localhost:3002/api/workflows');
  const text = await res.text();
  console.log('response:', text);
  process.exit(0);
});

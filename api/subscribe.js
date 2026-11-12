// Vercel serverless function: adds a waitlist email to Brevo.
// Env vars (Vercel > Settings > Environment Variables):
//   BREVO_API_KEY          required
//   BREVO_LIST_ID          optional (default 3, the waitlist list)
//   BREVO_CONFIRM_TEMPLATE_ID optional (default 5): Brevo template with a button linking to {{ params.CONFIRM_URL }}
//   Brevo contact attributes needed for the welcome step: FIRSTNAME, LOCATION, ROLE (text)
//   SITE_URL               optional, default https://www.zoryaai.com
const crypto = require('crypto');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const email = String(body.email || '').trim().toLowerCase();
  if (body.website) return res.status(200).json({ ok: true });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'email' });
  const firstName = String(body.firstName || '').trim().slice(0, 60);
  const key = process.env.BREVO_API_KEY, list = Number(process.env.BREVO_LIST_ID || 3);
  if (!key) return res.status(500).json({ error: 'config' });
  if (body.step === 'name') {
    if (!firstName) return res.status(400).json({ error: 'name' });
    try {
      const r = await fetch('https://api.brevo.com/v3/contacts', { method: 'POST', headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ email, attributes: { FIRSTNAME: firstName }, updateEnabled: true }) });
      return res.status(r.ok || r.status === 204 ? 200 : 502).json({ ok: r.ok });
    } catch (e) { return res.status(502).json({ error: 'network' }); }
  }
  if (body.step === 'profile') {
    const location = String(body.location || '').trim().slice(0, 120), role = String(body.role || '').trim().slice(0, 80);
    const attributes = {};
    if (firstName) attributes.FIRSTNAME = firstName;
    if (location) attributes.LOCATION = location;
    if (role) attributes.ROLE = role;
    try {
      const r = await fetch('https://api.brevo.com/v3/contacts', { method: 'POST', headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ email, attributes, updateEnabled: true }) });
      return res.status(r.ok || r.status === 204 ? 200 : 502).json({ ok: r.ok });
    } catch (e) { return res.status(502).json({ error: 'network' }); }
  }
  const site = process.env.SITE_URL || 'https://www.zoryaai.com';
  const tpl = Number(process.env.BREVO_CONFIRM_TEMPLATE_ID || 5);
  const data = Buffer.from(JSON.stringify({ e: email, x: Date.now() + 7 * 24 * 3600 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(data).digest('base64url');
  const confirmUrl = site + '/api/confirm?t=' + data + '.' + sig;
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ to: [{ email }], templateId: tpl, params: { CONFIRM_URL: confirmUrl } }) });
    if (r.ok) return res.status(200).json({ ok: true });
    const t = await r.text();
    console.error('brevo', r.status, t);
    return res.status(502).json({ error: 'brevo', status: r.status, detail: t.slice(0, 300) });
  } catch (e) {
    return res.status(502).json({ error: 'network' });
  }
};

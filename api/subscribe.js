// Vercel serverless function: adds a waitlist email to Brevo.
// Env vars (Vercel > Settings > Environment Variables):
//   BREVO_API_KEY          required
//   BREVO_LIST_ID          optional (default 3, the waitlist list)
//   BREVO_DOI_TEMPLATE_ID  optional (default 5, the double opt-in email template)
//   Brevo contact attributes needed for the welcome step: FIRSTNAME, LOCATION, ROLE (text)
//   SITE_URL               optional, default https://www.zoryaai.com
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const email = String(body.email || '').trim().toLowerCase();
  if (body.website) return res.status(200).json({ ok: true });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'email' });
  const firstName = String(body.firstName || '').trim().slice(0, 60);
const key = process.env.BREVO_API_KEY, list = Number(process.env.BREVO_LIST_ID || 3), doi = 1;  if (!key) return res.status(500).json({ error: 'config' });
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
  const url = 'https://api.brevo.com/v3/contacts/doubleOptinConfirmation';
  const payload = { email, includeListIds: [list], templateId: doi, redirectionUrl: site + '/confirmed' };
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok || r.status === 204) return res.status(200).json({ ok: true });
    const t = await r.text();
    if (/already exist/i.test(t)) return res.status(200).json({ ok: true });
    console.error('brevo', r.status, t);
    return res.status(502).json({ error: 'brevo', status: r.status, detail: t.slice(0, 300) });
  } catch (e) {
    return res.status(502).json({ error: 'network' });
  }
};

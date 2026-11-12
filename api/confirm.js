const crypto = require('crypto');
module.exports = async (req, res) => {
  const site = process.env.SITE_URL || 'https://www.zoryaai.com';
  const key = process.env.BREVO_API_KEY, list = Number(process.env.BREVO_LIST_ID || 3);
  const t = String((req.query && req.query.t) || '');
  const [data, sig] = t.split('.');
  try {
    if (!key || !data || !sig) throw new Error('bad');
    const good = crypto.createHmac('sha256', key).update(data).digest('base64url');
    if (good.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))) throw new Error('sig');
    const { e, x } = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!e || Date.now() > x) throw new Error('expired');
    const r = await fetch('https://api.brevo.com/v3/contacts', { method: 'POST', headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ email: e, listIds: [list], updateEnabled: true }) });
    if (!(r.ok || r.status === 204)) throw new Error('brevo');
    res.setHeader('Location', site + '/confirmed');
    return res.status(302).end();
  } catch (err) {
    res.setHeader('Location', site + '/');
    return res.status(302).end();
  }
};

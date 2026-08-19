import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readState, writeState, defaultState } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const app = express();
const port = process.env.PORT || 3000;
const APP_PIN = String(process.env.APP_PIN || '').trim();
const sessions = new Map();

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie || '';
  for (const chunk of header.split(';')) {
    const [k, ...v] = chunk.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  }
  return out;
}

function isAuthed(req) {
  if (!APP_PIN) return true;
  const token = parseCookies(req).wt_session;
  const session = token && sessions.get(token);
  if (!session) return false;
  if (session.expires < Date.now()) { sessions.delete(token); return false; }
  return true;
}

function auth(req, res, next) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.get('/api/session', (req, res) => {
  res.json({ authRequired: Boolean(APP_PIN), authenticated: isAuthed(req) });
});

app.post('/api/login', (req, res) => {
  if (!APP_PIN) return res.json({ ok: true });
  if (String(req.body?.pin || '') !== APP_PIN) return res.status(401).json({ error: 'PIN errato' });
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { expires: Date.now() + 1000 * 60 * 60 * 24 * 30 });
  res.setHeader('Set-Cookie', `wt_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  const token = parseCookies(req).wt_session;
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'wt_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/state', auth, async (_req, res) => res.json(await readState()));

app.put('/api/state', auth, async (req, res) => {
  const state = req.body;
  if (!state || !Array.isArray(state.jobs) || !Array.isArray(state.shifts) || !state.profile) {
    return res.status(400).json({ error: 'Formato dati non valido' });
  }
  state.version = 1;
  await writeState(state);
  res.json({ ok: true, savedAt: new Date().toISOString() });
});

app.get('/api/export', auth, async (_req, res) => {
  const state = await readState();
  res.setHeader('Content-Disposition', `attachment; filename="worktrack-backup-${new Date().toISOString().slice(0,10)}.json"`);
  res.type('application/json').send(JSON.stringify(state, null, 2));
});

app.post('/api/import', auth, async (req, res) => {
  const state = req.body;
  if (!state || !Array.isArray(state.jobs) || !Array.isArray(state.shifts)) return res.status(400).json({error:'Backup non valido'});
  state.profile ||= structuredClone(defaultState.profile);
  state.version = 1;
  await writeState(state);
  res.json({ ok: true });
});

app.use(express.static(path.join(root, 'dist'), { maxAge: '1h' }));
app.use((_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));

app.listen(port, '0.0.0.0', () => {
  console.log(`WorkTrack listening on :${port}`);
  if (!APP_PIN) console.log('WARNING: APP_PIN non impostato; accesso non protetto.');
});

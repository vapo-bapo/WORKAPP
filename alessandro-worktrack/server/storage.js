import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
const DATA_FILE = path.join(DATA_DIR, 'worktrack-state.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

export const defaultState = {
  version: 1,
  profile: { name: 'Alessandro', currency: 'EUR', weekStartsMonday: true },
  jobs: [],
  shifts: []
};

async function ensure() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  try { await fs.access(DATA_FILE); }
  catch { await writeState(defaultState, false); }
}

export async function readState() {
  await ensure();
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return structuredClone(defaultState);
  }
}

export async function writeState(state, backup = true) {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  if (backup) {
    try {
      const current = await fs.readFile(DATA_FILE, 'utf8');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await fs.writeFile(path.join(BACKUP_DIR, `${stamp}.json`), current, 'utf8');
      const files = (await fs.readdir(BACKUP_DIR)).sort().reverse();
      await Promise.all(files.slice(20).map(f => fs.unlink(path.join(BACKUP_DIR, f)).catch(() => {})));
    } catch {}
  }
  const tmp = DATA_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(tmp, DATA_FILE);
}

export { DATA_FILE };

import 'dotenv/config';
import crypto from 'crypto';
import http from 'http';
import { app } from '../server.js';
import { pool } from '../server/db/neon.js';

const suffix = crypto.randomUUID();
const email = `neon-cutover-${suffix}@test.invalid`;
const password = crypto.randomBytes(32).toString('base64url');
const userId = `usr-neon-test-${suffix}`;
let cookie = '';

async function neon(path: string, body?: unknown) {
  const response = await fetch(`${process.env.NEON_AUTH_URL}/api/auth/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), redirect: 'manual',
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Neon ${path}: HTTP ${response.status} ${JSON.stringify(json)}`);
  return json as any;
}

async function main() {
  const before = await pool.query(`SELECT count(*) AS inscriptions, (SELECT count(*) FROM payments WHERE status='VALIDE') AS payments, (SELECT coalesce(sum(amount),0) FROM payments WHERE status='VALIDE') AS amount, (SELECT count(*) FROM expenses) AS expenses, (SELECT count(*) FROM payment_schedules) AS schedules, (SELECT count(*) FROM payment_schedule_allocations) AS allocations FROM inscriptions`);
  let neonId = '';
  try {
    const registered = await neon('sign-up/email', { email, password, name: 'Neon Cutover Test' });
    neonId = registered?.user?.id;
    if (!neonId || !cookie) throw new Error('Neon signup did not return a user id and session cookie');

    await pool.query(`INSERT INTO users (id,email,display_name,password_hash,role_id,status,active,is_test,neon_auth_id) VALUES ($1,$2,'Neon Cutover Test','NOT_USED_BY_NEON','SUPER_ADMIN','ACTIF',TRUE,TRUE,$3)`, [userId, email, neonId]);
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const port = (server.address() as any).port;
    const request = async (path: string) => fetch(`http://127.0.0.1:${port}${path}`, { headers: { cookie } });
    const me = await request('/api/auth/me');
    const body = await me.json();
    if (me.status !== 200 || body.user?.id !== userId || body.user?.email !== email || body.user?.role !== 'SUPER_ADMIN') throw new Error(`Bridge /api/auth/me failed: ${me.status}`);
    const financial = await request('/api/payments');
    if (financial.status !== 200) throw new Error(`Authenticated financial GET failed: ${financial.status}`);
    await pool.query(`UPDATE users SET active=FALSE WHERE id=$1`, [userId]);
    const inactive = await request('/api/auth/me');
    if (inactive.status !== 401) throw new Error(`Inactive user was not refused: ${inactive.status}`);
    await pool.query(`UPDATE users SET active=TRUE WHERE id=$1`, [userId]);
    server.close();
    console.log(JSON.stringify({ neon_test_user_created: true, explicit_link: true, auth_me: 'PASS', financial_get: 'PASS', inactive_refusal: 'PASS' }));
  } finally {
    await pool.query(`UPDATE users SET neon_auth_id=NULL WHERE id=$1`, [userId]);
    await pool.query(`DELETE FROM users WHERE id=$1 AND is_test=TRUE`, [userId]);
    const after = await pool.query(`SELECT count(*) AS inscriptions, (SELECT count(*) FROM payments WHERE status='VALIDE') AS payments, (SELECT coalesce(sum(amount),0) FROM payments WHERE status='VALIDE') AS amount, (SELECT count(*) FROM expenses) AS expenses, (SELECT count(*) FROM payment_schedules) AS schedules, (SELECT count(*) FROM payment_schedule_allocations) AS allocations FROM inscriptions`);
    if (JSON.stringify(before.rows[0]) !== JSON.stringify(after.rows[0])) throw new Error('FINANCIAL_INVARIANTS_CHANGED');
    await pool.end();
  }
}
main().catch(error => { console.error(error.message); process.exit(1); });

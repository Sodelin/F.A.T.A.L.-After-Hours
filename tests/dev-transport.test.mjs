import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createD1 } from './d1-harness.mjs';
import { handleCampaignRequest } from '../lib/campaign/api.mjs';
import { fateAdapter } from '../lib/fate/adapter.mjs';
import { developmentRequest, developmentResponse } from '../lib/campaign/dev-transport.mjs';

const localOrigin = 'http://terminal.local:4173';
const localRequest = (url = `${localOrigin}/api/campaigns`, headers = {}) => new Request(url, { headers });
const cookieValue = (header, key) => header.split(';').map(part => part.trim()).find(part => part.startsWith(`${key}=`))?.split('=')[1];

test('development request transport matches only the exact local HTTP origin', () => {
  const headers = { cookie: 'dev-campaign-one=local-secret; unrelated=keep', origin: localOrigin };
  const changed = developmentRequest(localRequest(undefined, headers));
  assert.equal(cookieValue(changed.headers.get('cookie'), '__Host-campaign-one'), 'local-secret');
  assert.equal(cookieValue(changed.headers.get('cookie'), 'unrelated'), 'keep');
  assert.equal(changed.headers.get('origin'), localOrigin);
  for (const origin of ['http://terminal.local:4174', 'https://terminal.local:4173', 'http://terminal.local.attacker.example:4173', 'http://localhost:4173', 'http://example.com:4173']) {
    const request = localRequest(`${origin}/api/campaigns`, { ...headers, 'x-forwarded-host': 'terminal.local:4173' });
    const result = developmentRequest(request);
    assert.equal(result.headers.get('cookie'), request.headers.get('cookie'), origin);
    assert.equal(result.headers.get('origin'), localOrigin);
  }
});

test('development request transport separates cookie namespaces and preserves request security headers/body', async () => {
  const request = new Request(`${localOrigin}/api/campaigns/one/commands`, { method: 'POST', headers: { cookie: '__Host-campaign-one=production-secret; dev-campaign-one=local-secret; unrelated=keep', origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' }, body: JSON.stringify({ operationId: 'unchanged' }) });
  const converted = developmentRequest(request);
  assert.equal(cookieValue(converted.headers.get('cookie'), '__Host-campaign-one'), 'local-secret');
  assert.equal(converted.headers.get('cookie').includes('production-secret'), false);
  assert.equal(converted.headers.get('cookie').includes('dev-campaign-one'), false);
  assert.equal(converted.headers.get('origin'), 'https://attacker.example');
  assert.equal(converted.headers.get('sec-fetch-site'), 'cross-site');
  assert.equal(converted.method, 'POST');
  assert.equal(converted.url, request.url);
  assert.deepEqual(await converted.json(), { operationId: 'unchanged' });
  const noOrigin = developmentRequest(new Request(`${localOrigin}/api/campaigns`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }));
  assert.equal(noOrigin.headers.get('origin'), null);
});

test('development response transport changes only campaign cookie name and Secure attribute', async () => {
  const headers = new Headers({ 'cache-control': 'no-store', 'x-test': 'preserved' });
  headers.append('set-cookie', '__Host-campaign-one=first; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=31536000');
  headers.append('set-cookie', '__Host-campaign-two=second; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=120');
  headers.append('set-cookie', 'unrelated=value; Secure; HttpOnly; Path=/');
  const converted = developmentResponse(new Response('{"saved":true}', { status: 201, headers }));
  const cookies = converted.headers.getSetCookie();
  assert.equal(converted.status, 201);
  assert.equal(converted.headers.get('cache-control'), 'no-store');
  assert.equal(converted.headers.get('x-test'), 'preserved');
  assert.equal(cookies.length, 3);
  for (const name of ['one', 'two']) {
    const cookie = cookies.find(cookie => cookie.startsWith(`dev-campaign-${name}=`));
    assert.ok(cookie);
    assert.doesNotMatch(cookie, /;\s*Secure(?:;|$)/i);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.match(cookie, /Path=\//i);
    assert.match(cookie, /Max-Age=/i);
  }
  assert.equal(cookies.find(cookie => cookie.startsWith('unrelated=')), 'unrelated=value; Secure; HttpOnly; Path=/');
  assert.deepEqual(await converted.json(), { saved: true });
});

test('development transport still requires valid memberships, roles, Origin and nonrevoked sessions', async () => {
  const migrations = new URL('../drizzle/', import.meta.url);
  const sql = readdirSync(migrations).filter(name => name.endsWith('.sql')).sort().map(name => readFileSync(new URL(name, migrations), 'utf8')).join('\n');
  const db = createD1(sql);
  async function call(path, { cookie, body, method = 'GET', origin = localOrigin, development = true } = {}) {
    const request = new Request(`${localOrigin}${path}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(method === 'POST' ? { 'content-type': 'application/json', ...(origin ? { origin } : {}) } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const response = await handleCampaignRequest(development ? developmentRequest(request) : request, db, fateAdapter);
    const converted = development ? developmentResponse(response) : response;
    return { status: converted.status, body: await converted.json(), cookie: converted.headers.get('set-cookie')?.split(';')[0], cookieHeader: converted.headers.get('set-cookie') };
  }
  const post = (path, body, cookie, extra) => call(path, { body, cookie, method: 'POST', ...extra });
  const gm = await post('/api/campaigns', { title: 'Local QA campaign', name: 'GM' });
  assert.equal(gm.status, 201, JSON.stringify(gm.body));
  assert.match(gm.cookie, /^dev-campaign-/);
  assert.doesNotMatch(gm.cookieHeader, /;\s*Secure(?:;|$)/i);
  const id = gm.body.campaign.id;
  assert.equal((await call(`/api/campaigns/${id}`, { cookie: gm.cookie })).status, 200);
  assert.equal((await call(`/api/campaigns/${id}`, { cookie: `dev-campaign-${id}=${'f'.repeat(64)}` })).status, 401);
  const invite = await post(`/api/campaigns/${id}/invite`, {}, gm.cookie);
  const player = await post(`/api/campaigns/${id}/join`, { secret: invite.body.secret, name: 'Player' });
  assert.equal(player.status, 201, JSON.stringify(player.body));
  assert.equal((await post(`/api/campaigns/${id}/invite`, {}, player.cookie)).status, 403);
  assert.equal((await post(`/api/campaigns/${id}/invite`, {}, gm.cookie, { origin: 'https://attacker.example' })).status, 403);
  assert.equal((await post(`/api/campaigns/${id}/invite`, {}, gm.cookie, { origin: null })).status, 403);
  assert.equal((await post(`/api/campaigns/${id}/revoke`, { memberId: player.body.member.id }, gm.cookie)).status, 200);
  assert.equal((await call(`/api/campaigns/${id}`, { cookie: player.cookie })).status, 401);
  assert.equal((await post(`/api/campaigns/${id}/resume`, { secret: player.body.resumeSecret })).status, 403);
  const ordinary = await post('/api/campaigns', { title: 'No development transform', name: 'GM' }, undefined, { development: false });
  assert.match(ordinary.cookie, /^__Host-campaign-/);
  assert.match(ordinary.cookieHeader, /;\s*Secure(?:;|$)/i);
  assert.equal((await call(`/api/campaigns/${id}`, { cookie: gm.cookie, development: false })).status, 401);
});

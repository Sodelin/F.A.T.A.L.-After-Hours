/** Reusable Cloudflare Worker / D1 campaign kernel. No client-supplied actor or state writes. */
const COOKIE_PREFIX = '__Host-campaign-';
const MAX_BODY = 3 * 1024 * 1024;
const MAX_STATE = 2 * 1024 * 1024;
const MAX_MEMBERS = 32;
const MAX_LIST_SESSIONS = 40;
const encoder = new TextEncoder();
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie' };
class APIError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new APIError(status, message); };
const response = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { ...jsonHeaders, ...headers } });
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
const cookieName = id => `${COOKIE_PREFIX}${id}`;
const cookie = (id, secret) => `${cookieName(id)}=${secret}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=31536000`;
const query = (db, sql, ...args) => db.prepare(sql).bind(...args);
const first = (db, sql, ...args) => query(db, sql, ...args).first();
const all = async (db, sql, ...args) => (await query(db, sql, ...args).all()).results;
const changed = result => Number(result?.meta?.changes ?? result?.changes ?? 0);
const publicMember = member => ({ id: member.id, name: member.name, role: member.role });
const validObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nameValue = value => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(value)) fail(400, 'Name must contain 1–80 characters.');
  return value.trim();
};
const titleValue = value => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(value)) fail(400, 'Title must contain 1–100 characters.');
  return value.trim();
};
const secretValue = value => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail(400, 'Invalid secret.');
  return value;
};
const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (validObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
function encodeState(title, state) {
  if (!validObject(state)) fail(500, 'Adapter returned an invalid campaign state.');
  const serialized = JSON.stringify({ title, state });
  if (encoder.encode(serialized).length > MAX_STATE) fail(413, 'Campaign state is too large.');
  return serialized;
}
async function readBody(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') fail(415, 'Use application/json.');
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY) fail(413, 'Request body is too large.');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'JSON body required.');
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY) { await reader.cancel(); fail(413, 'Request body is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail(400, 'Invalid JSON.'); }
  if (!validObject(body)) fail(400, 'JSON object required.');
  return body;
}
function cookies(request) {
  const header = request.headers.get('cookie') || '';
  if (header.length > 24000) fail(400, 'Too many campaign sessions.');
  return new Map(header.split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
}
async function authenticate(db, request, campaignId) {
  const secret = cookies(request).get(cookieName(campaignId));
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) fail(401, 'Campaign session required.');
  const sessionHash = await hash(secret);
  const member = await first(db, 'SELECT * FROM memberships WHERE campaign_id = ? AND session_hash = ? AND revoked = 0', campaignId, sessionHash);
  if (!member) fail(401, 'Campaign session expired or revoked.');
  return { member: Object.freeze(publicMember(member)), sessionHash };
}
const requireGM = member => { if (member.role !== 'gm') fail(403, 'Game master permission required.'); };
async function campaignView(db, adapter, campaignId, member) {
  const row = await first(db, 'SELECT * FROM campaigns WHERE id = ?', campaignId);
  if (!row) fail(404, 'Campaign not found.');
  const stored = JSON.parse(row.state);
  const state = await adapter.project(stored.state, member);
  const members = await all(db, 'SELECT id, name, role FROM memberships WHERE campaign_id = ? AND revoked = 0 ORDER BY role, name, id', campaignId);
  return { campaign: { id: row.id, title: stored.title, revision: row.revision, state }, member, members };
}
async function createCampaign(db, adapter, title, name, importedState) {
  const id = crypto.randomUUID(), memberId = crypto.randomUUID(), session = random(), resume = random();
  const state = importedState ?? await adapter.initialState({ title });
  const member = { id: memberId, name, role: 'gm' };
  const serialized = encodeState(title, state);
  const projectedState = await adapter.project(structuredClone(state), Object.freeze(member));
  await db.batch([
    query(db, 'INSERT INTO campaigns (id, state, revision, created_at) VALUES (?, ?, 0, ?)', id, serialized, Date.now()),
    query(db, 'INSERT INTO memberships (id, campaign_id, name, role, session_hash, resume_hash, revoked) VALUES (?, ?, ?, ?, ?, ?, 0)', memberId, id, name, 'gm', await hash(session), await hash(resume)),
  ]);
  return response({ campaign: { id, title, revision: 0, state: projectedState }, member, members: [member], resumeSecret: resume }, 201, { 'Set-Cookie': cookie(id, session) });
}
const ACTIVE_MEMBER = 'EXISTS (SELECT 1 FROM memberships WHERE id = ? AND campaign_id = ? AND session_hash = ? AND revoked = 0)';
const ACTIVE_GM = "EXISTS (SELECT 1 FROM memberships WHERE id = ? AND campaign_id = ? AND session_hash = ? AND revoked = 0 AND role = 'gm')";

/**
 * adapter: initialState({title}), project(state, member), command(state, member, type, payload).
 * command -> {state,result}; validateImport(state) -> normalized state or throws (optional).
 * All adapter methods may be async. Adapter must never place access secrets in state/results.
 */
export async function handleCampaignRequest(request, db, adapter) {
  try {
    const url = new URL(request.url);
    if (url.search) fail(400, 'API query parameters are not supported.');
    if (!['GET', 'POST'].includes(request.method)) fail(405, 'Method not allowed.');
    if (request.method === 'POST' && request.headers.get('origin') !== url.origin) fail(403, 'Same-origin request required.');
    if (request.method === 'POST' && request.headers.get('sec-fetch-site') === 'cross-site') fail(403, 'Same-origin request required.');
    if (url.pathname === '/api/campaigns') {
      if (request.method === 'POST') {
        const body = await readBody(request);
        return await createCampaign(db, adapter, titleValue(body.title), nameValue(body.name));
      }
      const sessions = [...cookies(request)].filter(([key, value]) => key.startsWith(COOKIE_PREFIX) && /^[a-f0-9]{64}$/.test(value));
      const campaigns = [];
      for (const [key, secret] of sessions.slice(0, MAX_LIST_SESSIONS)) {
        const id = key.slice(COOKIE_PREFIX.length);
        const row = await first(db, 'SELECT c.id, c.state, c.revision, m.id AS member_id, m.name, m.role FROM campaigns c JOIN memberships m ON m.campaign_id = c.id WHERE c.id = ? AND m.session_hash = ? AND m.revoked = 0', id, await hash(secret));
        if (row) campaigns.push({ id: row.id, title: JSON.parse(row.state).title, revision: row.revision, member: { id: row.member_id, name: row.name, role: row.role } });
      }
      return response({ campaigns });
    }
    if (url.pathname === '/api/import' && request.method === 'POST') {
      if (typeof adapter.validateImport !== 'function') fail(501, 'Import is not supported by this rules adapter.');
      const body = await readBody(request), backup = body.backup;
      if (!validObject(backup) || backup.format !== 'campaign-backup-v1' || backup.access !== 'gm' || !validObject(backup.campaign)) fail(400, 'A game master campaign backup is required.');
      const title = titleValue(body.title ?? backup.campaign.title), name = nameValue(body.name);
      let state;
      try { state = await adapter.validateImport(backup.campaign.state); } catch { fail(400, 'Invalid campaign backup state.'); }
      if (!validObject(state)) fail(400, 'Invalid campaign backup state.');
      return await createCampaign(db, adapter, title, name, state);
    }
    const match = /^\/api\/campaigns\/([a-zA-Z0-9-]{1,80})(?:\/(join|resume|invite|resume-link|revoke|commands|export))?$/.exec(url.pathname);
    if (!match) fail(404, 'API route not found.');
    const [, id, action] = match;
    if ((action === 'join' || action === 'resume') && request.method === 'POST') {
      const body = await readBody(request), secretHash = await hash(secretValue(body.secret)), session = random(), sessionHash = await hash(session);
      if (action === 'join') {
        const memberId = crypto.randomUUID(), name = nameValue(body.name), resume = random();
        const now = Date.now();
        const result = await query(db, "INSERT INTO memberships (id, campaign_id, name, role, session_hash, resume_hash, revoked) SELECT ?, ?, ?, 'player', ?, ?, 0 WHERE EXISTS (SELECT 1 FROM invites WHERE hash = ? AND campaign_id = ? AND revoked = 0 AND expires_at > ?) AND (SELECT COUNT(*) FROM memberships WHERE campaign_id = ? AND revoked = 0) < ?", memberId, id, name, sessionHash, await hash(resume), secretHash, id, now, id, MAX_MEMBERS).run();
        if (!changed(result)) {
          const full = await first(db, 'SELECT 1 AS full FROM invites WHERE hash = ? AND campaign_id = ? AND revoked = 0 AND expires_at > ? AND (SELECT COUNT(*) FROM memberships WHERE campaign_id = ? AND revoked = 0) >= ?', secretHash, id, now, id, MAX_MEMBERS);
          if (full) fail(409, 'Campaign has reached its 32-member limit.');
          fail(403, 'Invitation is invalid or expired.');
        }
        return response({ ...await campaignView(db, adapter, id, { id: memberId, name, role: 'player' }), resumeSecret: resume }, 201, { 'Set-Cookie': cookie(id, session) });
      }
      const result = await query(db, 'UPDATE memberships SET session_hash = ? WHERE campaign_id = ? AND resume_hash = ? AND revoked = 0', sessionHash, id, secretHash).run();
      if (!changed(result)) fail(403, 'Resume secret is invalid or revoked.');
      const member = await first(db, 'SELECT id, name, role FROM memberships WHERE campaign_id = ? AND session_hash = ? AND revoked = 0', id, sessionHash);
      if (!member) fail(401, 'Campaign session expired or revoked.');
      return response(await campaignView(db, adapter, id, member), 200, { 'Set-Cookie': cookie(id, session) });
    }
    const { member, sessionHash } = await authenticate(db, request, id);
    if (!action && request.method === 'GET') return response(await campaignView(db, adapter, id, member));
    if (action === 'export' && request.method === 'GET') {
      const row = await first(db, 'SELECT * FROM campaigns WHERE id = ?', id);
      const stored = JSON.parse(row.state);
      const state = member.role === 'gm' ? stored.state : await adapter.project(stored.state, member);
      return response({ format: 'campaign-backup-v1', access: member.role, campaign: { title: stored.title, revision: row.revision, state } });
    }
    if (request.method !== 'POST') fail(405, 'Method not allowed.');
    const body = await readBody(request);
    if (action === 'invite') {
      requireGM(member);
      const secret = random(), expiresAt = Date.now() + 7 * 86400000;
      const results = await db.batch([
        query(db, `UPDATE invites SET revoked = 1 WHERE campaign_id = ? AND revoked = 0 AND ${ACTIVE_GM}`, id, member.id, id, sessionHash),
        query(db, `INSERT INTO invites (hash, campaign_id, expires_at, revoked) SELECT ?, ?, ?, 0 WHERE ${ACTIVE_GM}`, await hash(secret), id, expiresAt, member.id, id, sessionHash),
      ]);
      if (!changed(results[1])) fail(401, 'Campaign session expired or revoked.');
      return response({ secret, expiresAt }, 201);
    }
    if (action === 'resume-link') {
      const secret = random();
      const result = await query(db, 'UPDATE memberships SET resume_hash = ? WHERE id = ? AND campaign_id = ? AND session_hash = ? AND revoked = 0', await hash(secret), member.id, id, sessionHash).run();
      if (!changed(result)) fail(401, 'Campaign session expired or revoked.');
      return response({ secret });
    }
    if (action === 'revoke') {
      requireGM(member);
      if (typeof body.memberId !== 'string' || body.memberId === member.id) fail(400, 'Choose another campaign member.');
      const results = await db.batch([
        // Both statements require the same active GM and active player within one transaction.
        // Revoking invitations first keeps an invalid target from mutating any capabilities.
        query(db, `UPDATE invites SET revoked = 1 WHERE campaign_id = ? AND revoked = 0 AND ${ACTIVE_GM} AND EXISTS (SELECT 1 FROM memberships WHERE id = ? AND campaign_id = ? AND role = 'player' AND revoked = 0)`, id, member.id, id, sessionHash, body.memberId, id),
        query(db, `UPDATE memberships SET revoked = 1, resume_hash = NULL WHERE id = ? AND campaign_id = ? AND role = 'player' AND revoked = 0 AND ${ACTIVE_GM}`, body.memberId, id, member.id, id, sessionHash),
      ]);
      if (!changed(results[1])) {
        await authenticate(db, request, id);
        fail(404, 'Active player membership not found.');
      }
      return response({ revoked: body.memberId });
    }
    if (action !== 'commands') fail(404, 'API route not found.');
    if (typeof body.operationId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(body.operationId)) fail(400, 'A valid operationId is required.');
    if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) fail(400, 'A valid expectedRevision is required.');
    if (typeof body.type !== 'string' || !/^[a-zA-Z][a-zA-Z0-9._-]{0,79}$/.test(body.type)) fail(400, 'A valid command type is required.');
    if (!validObject(body.payload)) fail(400, 'Command payload must be an object.');
    if (encoder.encode(JSON.stringify(body.payload)).length > 65536) fail(413, 'Command payload is too large.');
    const payloadHash = await hash(canonical({ expectedRevision: body.expectedRevision, type: body.type, payload: body.payload }));
    const receiptSQL = 'SELECT payload_hash, result FROM operations WHERE campaign_id = ? AND member_id = ? AND operation_id = ?';
    const receiptArgs = [id, member.id, body.operationId];
    const replay = receipt => {
      if (receipt.payload_hash !== payloadHash) fail(409, 'operationId was already used for different content.');
      return response(JSON.parse(receipt.result));
    };
    const existing = await first(db, receiptSQL, ...receiptArgs);
    if (existing) return replay(existing);
    const row = await first(db, 'SELECT state, revision FROM campaigns WHERE id = ?', id);
    if (row.revision !== body.expectedRevision) return response({ error: 'Campaign changed. Reload before retrying.', revision: row.revision }, 409);
    const stored = JSON.parse(row.state);
    let outcome;
    try { outcome = await adapter.command(stored.state, member, body.type, body.payload); }
    catch (error) {
      const status = [400, 403, 404, 409].includes(error?.status) ? error.status : 400;
      fail(status, typeof error?.message === 'string' ? error.message.slice(0, 300) : 'Command rejected.');
    }
    if (!validObject(outcome) || !validObject(outcome.state)) fail(500, 'Adapter returned an invalid command outcome.');
    const serializedState = encodeState(stored.title, outcome.state), commitToken = random();
    const committed = { operationId: body.operationId, revision: row.revision + 1, result: outcome.result ?? null };
    const serializedResult = JSON.stringify(committed);
    if (encoder.encode(serializedResult).length > 262144) fail(413, 'Command result is too large.');
    const results = await db.batch([
      query(db, `UPDATE campaigns SET state = ?, revision = revision + 1, last_operation = ? WHERE id = ? AND revision = ? AND ${ACTIVE_MEMBER} AND NOT EXISTS (SELECT 1 FROM operations WHERE campaign_id = ? AND member_id = ? AND operation_id = ?)`, serializedState, commitToken, id, body.expectedRevision, member.id, id, sessionHash, ...receiptArgs),
      query(db, 'INSERT INTO operations (campaign_id, member_id, operation_id, payload_hash, result) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM campaigns WHERE id = ? AND last_operation = ?)', ...receiptArgs, payloadHash, serializedResult, id, commitToken),
    ]);
    if (changed(results[0])) return response(committed);
    // A competing request or revoked/rotated session can invalidate work during adapter execution.
    await authenticate(db, request, id);
    const concurrentReceipt = await first(db, receiptSQL, ...receiptArgs);
    if (concurrentReceipt) return replay(concurrentReceipt);
    const latest = await first(db, 'SELECT revision FROM campaigns WHERE id = ?', id);
    return response({ error: 'Campaign changed. Reload before retrying.', revision: latest.revision }, 409);
  } catch (error) {
    if (error instanceof APIError) return response({ error: error.message }, error.status);
    return response({ error: 'Campaign service could not complete this request.' }, 500);
  }
}

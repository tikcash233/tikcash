import { query } from '../db.js';
import { parseNumericFields } from '../utils.js';

export async function listCreators({ sort = '-total_earnings', category, search, created_by } = {}) {
  const sorts = new Map([
    ['-total_earnings', 'total_earnings DESC'],
    ['total_earnings', 'total_earnings ASC'],
    ['-created_at', 'created_at DESC'],
  ]);
  const orderBy = sorts.get(sort) || 'total_earnings DESC';
  const clauses = [];
  const params = [];
  if (category && category !== 'all') {
    params.push(category);
    clauses.push(`category = $${params.length}`);
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    clauses.push(`(lower(display_name) LIKE $${params.length} OR lower(tiktok_username) LIKE $${params.length} OR lower(coalesce(bio,'')) LIKE $${params.length})`);
  }
  if (created_by) {
    params.push(created_by);
    clauses.push(`created_by = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `SELECT * FROM creators ${where} ORDER BY ${orderBy} LIMIT 200`;
  const res = await query(sql, params);
  return res.rows.map(r => parseNumericFields(r, ['total_earnings','available_balance']));
}

export async function createCreator(data) {
  const fields = [
    'tiktok_username','display_name','bio','profile_image','follower_count','total_earnings','available_balance','phone_number','preferred_payment_method','is_verified','category','created_by'
  ];
  const cols = [];
  const vals = [];
  const params = [];
  fields.forEach((k) => {
    if (data[k] !== undefined) {
      cols.push(k);
      params.push(data[k]);
      vals.push(`$${params.length}`);
    }
  });
  const sql = `INSERT INTO creators(${cols.join(',')}) VALUES(${vals.join(',')}) RETURNING *`;
  const res = await query(sql, params);
  const row = res.rows[0];
  return row ? parseNumericFields(row, ['total_earnings','available_balance']) : null;
}

export async function updateCreator(id, patch) {
  const sets = [];
  const params = [];
  Object.entries(patch).forEach(([k, v]) => {
    params.push(v);
    sets.push(`${k} = $${params.length}`);
  });
  params.push(id);
  const sql = `UPDATE creators SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`;
  const res = await query(sql, params);
  const row = res.rows[0];
  return row ? parseNumericFields(row, ['total_earnings','available_balance']) : null;
}

export async function getCreatorById(id) {
  const res = await query('SELECT * FROM creators WHERE id = $1', [id]);
  const row = res.rows[0];
  return row ? parseNumericFields(row, ['total_earnings','available_balance']) : null;
}

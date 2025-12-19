import { pool, query } from '../db.js';

export async function createSupportTicket({ name, email, phone, message }) {
  const res = await query(
    `INSERT INTO tikcash_support_tickets(name, email, phone, message) VALUES($1,$2,$3,$4) RETURNING *`,
    [name, email, phone || null, message]
  );
  return res.rows[0];
}

export async function listSupportTickets({ limit = 200, offset = 0 } = {}) {
  const res = await query(`SELECT * FROM tikcash_support_tickets ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
  return res.rows;
}

export async function getSupportTicketById(id) {
  const res = await query(`SELECT * FROM tikcash_support_tickets WHERE id = $1 LIMIT 1`, [id]);
  return res.rows[0] || null;
}

export async function respondToSupportTicket(id, { adminId, status = 'resolved' }) {
  const res = await query(
    `UPDATE tikcash_support_tickets SET status = $1, responded_by = $2, responded_at = now() WHERE id = $3 RETURNING *`,
    [status, adminId || null, id]
  );
  return res.rows[0] || null;
}

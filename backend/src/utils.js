export function parseNumericFields(row, fields) {
  const out = { ...row };
  for (const f of fields) {
    if (out[f] !== undefined && out[f] !== null) out[f] = Number(out[f]);
  }
  return out;
}

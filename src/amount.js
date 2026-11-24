// Shared amount parser for both calculation models.
export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if(typeof value!=='string') return NaN;
  const s=value.trim();
  // Unambiguous entry: no thousands separators. Accept either decimal mark.
  if(/^[1-9]\d{0,2}[.,]\d{3}$/.test(s))return NaN; // Ambiguous grouping: 1.000 must not silently become 1.
  return /^\d+(?:[.,]\d{1,6})?$/.test(s) ? Number(s.replace(',','.')) : NaN;
}

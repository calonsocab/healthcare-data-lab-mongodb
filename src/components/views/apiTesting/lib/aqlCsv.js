export const getAqlColumnLabel = (column, index) => (
  column?.name || column?.path || `Column ${index + 1}`
);

export const serializeAqlCellValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const escapeCsvCell = (value) => `"${String(value).replace(/"/g, '""')}"`;

export const buildAqlCsv = (results) => {
  if (!results || !Array.isArray(results.columns) || !Array.isArray(results.rows)) return '';

  const header = results.columns.map((col, idx) => escapeCsvCell(getAqlColumnLabel(col, idx))).join(',');
  const body = results.rows.map((row) => (
    results.columns.map((col, colIdx) => {
      if (col?.kind === 'projection_error') {
        const diagnostic = col.diagnostic || {};
        return escapeCsvCell(`ERROR: ${diagnostic.message || 'Projection could not be resolved'}`);
      }
      const value = row[col.name] !== undefined ? row[col.name] : row[colIdx];
      return escapeCsvCell(serializeAqlCellValue(value));
    }).join(',')
  ));
  return [header, ...body].join('\n');
};

/**
 * Minimal CSV parser for validation scripts.
 *
 * Handles quoted fields, doubled-quote escapes, and CRLF line endings.
 * Extracted from validate-construct.mjs.
 */

/**
 * Parses a single CSV line into an array of field strings.
 * Supports quoted fields with embedded commas and doubled-quote escapes.
 */
export function parseCsvRow(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Reads and parses a CSV file.
 * Returns `{ headers, rows }` where each row is an object keyed by header
 * name, with an added `_row` field (1-based line number, starting at 2).
 */
export function readCsv(raw, requiredHeaders) {
  const lines = raw.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error("CSV 内容为空");
  }
  const headers = parseCsvRow(lines[0]);
  if (requiredHeaders) {
    for (const required of requiredHeaders) {
      if (!headers.includes(required)) {
        throw new Error(`CSV 缺少字段：${required}`);
      }
    }
  }
  const rows = lines.slice(1).map((line, rowIndex) => {
    const fields = parseCsvRow(line);
    const row = {};
    headers.forEach((header, headerIndex) => {
      row[header] = (fields[headerIndex] ?? "").trim();
    });
    row._row = rowIndex + 2;
    return row;
  });
  return { headers, rows };
}

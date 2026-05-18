// Minimal delimiter sniffing + line/field split for admin CSV bulk import.

var CsvParse = {
  splitLines: function (text) {
    return String(text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(function (l) {
        return l.trim();
      })
      .filter(function (l) {
        return l.length > 0;
      });
  },

  /** Prefer tab if any line contains a tab; else comma. */
  sniffDelimiter: function (line) {
    if (/\t/.test(line)) return '\t';
    return ',';
  },

  splitRow: function (line, delim) {
    if (delim === '\t') return line.split('\t').map(function (c) { return c.trim(); });
    var out = [];
    var cur = '';
    var inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (!inQ && ch === ',') {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  },
};

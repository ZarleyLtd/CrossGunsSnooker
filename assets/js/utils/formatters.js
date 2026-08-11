// Data Formatting Utilities
// Common formatting functions used across the application

const Formatters = {
  /**
   * Safely convert to integer with fallback
   * @param {any} value - Value to convert
   * @param {number} fallback - Fallback value if conversion fails (default: -Infinity)
   * @returns {number} Integer value or fallback
   */
  toInt: function(value, fallback = -Infinity) {
    const num = parseInt(value, 10);
    return isNaN(num) ? fallback : num;
  },
  
  /**
   * Safely get string value
   * @param {any} value - Value to convert to string
   * @returns {string} Trimmed string or empty string
   */
  safeString: function(value) {
    return (value == null || value === undefined) ? '' : String(value).trim();
  },
  
  /**
   * Pad string left
   * @param {string} str - String to pad
   * @param {number} width - Target width
   * @returns {string} Left-padded string
   */
  padLeft: function(str, width) {
    str = this.safeString(str);
    return str.length >= width ? str : ' '.repeat(width - str.length) + str;
  },
  
  /**
   * Pad string right
   * @param {string} str - String to pad
   * @param {number} width - Target width
   * @returns {string} Right-padded string
   */
  padRight: function(str, width) {
    str = this.safeString(str);
    return str.length >= width ? str : str + ' '.repeat(width - str.length);
  },
  
  /**
   * Truncate name to max length
   * @param {string} name - Name to truncate
   * @param {number} maxLength - Maximum length (default: 16)
   * @returns {string} Truncated name with '..' suffix if needed
   */
  truncateName: function(name, maxLength = 16) {
    name = this.safeString(name);
    return name.length > maxLength ? name.slice(0, maxLength - 2) + '..' : name;
  },

  /**
   * Display label for a snooker handicap value.
   * @param {number|null|undefined} value
   * @returns {string} e.g. "Minus 5", "Zero", "+35"
   */
  formatHandicapLabel: function (value) {
    if (value == null || value === '') return '';
    var n = Number(value);
    if (!Number.isFinite(n)) return '';
    n = Math.trunc(n);
    if (n === 0) return 'Zero';
    if (n < 0) return 'Minus ' + Math.abs(n);
    return '+' + n;
  },

  /**
   * Compact handicap for labels, e.g. "0", "-5", "+30".
   * @param {number|null|undefined} value
   * @returns {string}
   */
  formatHandicapParenValue: function (value) {
    if (value == null || value === '') return '';
    var n = Number(value);
    if (!Number.isFinite(n)) return '';
    n = Math.trunc(n);
    if (n === 0) return '0';
    if (n > 0) return '+' + n;
    return String(n);
  },

  _monthShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

  /**
   * Format an ISO date (YYYY-MM-DD) for display, e.g. "31 Jan 2026".
   * @param {string} iso
   * @returns {string}
   */
  formatMatchDateDisplay: function (iso) {
    var m = String(iso == null ? '' : iso)
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    var monthIdx = parseInt(m[2], 10) - 1;
    if (monthIdx < 0 || monthIdx > 11) return '';
    return parseInt(m[3], 10) + ' ' + this._monthShort[monthIdx] + ' ' + m[1];
  },

  /**
   * Parse a match-date string to YYYY-MM-DD.
   * Accepts "31 Jan 2026", "31/01/2026", or "2026-01-31".
   * @param {string} value
   * @returns {string} ISO date or ''
   */
  parseMatchDateToISO: function (value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return '';

    var iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      return this._validISODate(iso[1], iso[2], iso[3]);
    }

    var slash = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (slash) {
      return this._validISODate(slash[3], slash[2], slash[1]);
    }

    var named = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
    if (named) {
      var monthNum = this._monthNameToNumber(named[2]);
      if (!monthNum) return '';
      return this._validISODate(named[3], monthNum, named[1]);
    }

    return '';
  },

  _monthNameToNumber: function (name) {
    var key = String(name || '')
      .trim()
      .toLowerCase()
      .slice(0, 3);
    var i;
    for (i = 0; i < this._monthShort.length; i++) {
      if (this._monthShort[i].toLowerCase() === key) {
        return String(i + 1).padStart(2, '0');
      }
    }
    return '';
  },

  _validISODate: function (year, month, day) {
    var y = String(year);
    var m = String(month).padStart(2, '0');
    var d = String(day).padStart(2, '0');
    var nY = parseInt(y, 10);
    var nM = parseInt(m, 10);
    var nD = parseInt(d, 10);
    if (!nY || nM < 1 || nM > 12 || nD < 1 || nD > 31) return '';
    var dt = new Date(nY, nM - 1, nD);
    if (dt.getFullYear() !== nY || dt.getMonth() !== nM - 1 || dt.getDate() !== nD) {
      return '';
    }
    return y + '-' + m + '-' + d;
  }
};
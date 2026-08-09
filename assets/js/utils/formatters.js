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
  }
};
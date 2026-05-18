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
  }
};
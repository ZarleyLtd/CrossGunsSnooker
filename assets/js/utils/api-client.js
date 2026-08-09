// API Client Utility
// Thin wrapper around fetch() that talks to the `crossguns-api` Edge Function.
// Uses simple GETs with no custom headers and POSTs with
// application/x-www-form-urlencoded so no CORS preflight is triggered.

const ApiClient = {
  /**
   * Make a GET request to the backend API.
   * @param {Object} params - Query parameters (must include `action`)
   * @returns {Promise} Resolves with the parsed JSON response on success
   */
  get: function(params) {
    return new Promise((resolve, reject) => {
      const apiUrl = (typeof AppConfig !== 'undefined') ? AppConfig.apiUrl : null;
      if (!apiUrl) {
        reject(new Error('API URL not configured. Update assets/js/config/app-config.js'));
        return;
      }
      if (!params || !params.action) {
        reject(new Error('action parameter is required'));
        return;
      }

      const qs = new URLSearchParams(params).toString();
      const url = `${apiUrl}?${qs}`;

      fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' })
        .then(response => {
          return response.text().then(text => {
            try {
              return JSON.parse(text);
            } catch (e) {
              throw new Error(`Invalid JSON response (status ${response.status}): ${text.substring(0, 200)}`);
            }
          });
        })
        .then(result => {
          if (result && result.success) {
            resolve(result);
          } else if (result && result.error) {
            reject(new Error(result.error));
          } else {
            reject(new Error('Unknown error from server'));
          }
        })
        .catch(err => {
          if (err && (err.message || '').match(/Failed to fetch|NetworkError|CORS/i)) {
            reject(new Error('Network/CORS error: Could not reach the API. Check apiUrl in app-config.js.'));
          } else {
            reject(err);
          }
        });
    });
  },

  /**
   * Make a POST request to the backend API. Uses form-encoded body (simple CORS).
   * Sends adminToken from options.adminToken, or sessionStorage key crossgunsAdminToken,
   * except for action adminLogin / verifyPasscode (no token attached).
   * For score actions, falls back to the score-passcode session token when Admin is locked.
   * @param {string} action
   * @param {Object} data
   * @param {{ adminToken?: string|null }} [options]
   * @returns {Promise}
   */
  post: function(action, data, options) {
    return new Promise((resolve, reject) => {
      const apiUrl = (typeof AppConfig !== 'undefined') ? AppConfig.apiUrl : null;
      if (!apiUrl) {
        reject(new Error('API URL not configured. Update assets/js/config/app-config.js'));
        return;
      }
      if (!action) {
        reject(new Error('action is required'));
        return;
      }

      const payload = { action: action, data: data || {} };
      const opts = options || {};
      const noTokenActions = { adminLogin: true, verifyPasscode: true };
      const scoreActions = {
        updateFixtureResult: true,
        upsertBreak: true,
        deleteBreak: true,
      };
      let token = opts.adminToken;
      if (token === undefined && typeof sessionStorage !== 'undefined' && !noTokenActions[action]) {
        token = sessionStorage.getItem('crossgunsAdminToken');
        if ((!token || !String(token).trim()) && scoreActions[action]) {
          token = sessionStorage.getItem('crossgunsScorePassToken');
        }
      }
      if (typeof token === 'string') {
        token = token.trim();
        if (!token) token = null;
      }
      if (token && !noTokenActions[action]) {
        payload.adminToken = token;
      }

      const formData = new URLSearchParams();
      formData.append('data', JSON.stringify(payload));

      fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        redirect: 'follow'
      })
        .then(response => response.text().then(text => {
          try { return JSON.parse(text); } catch (e) {
            throw new Error(`Invalid JSON response (status ${response.status}): ${text.substring(0, 200)}`);
          }
        }))
        .then(result => {
          if (result && result.success) resolve(result);
          else if (result && result.error) reject(new Error(result.error));
          else reject(new Error('Unknown error from server'));
        })
        .catch(reject);
    });
  }
};

// Image Compression Utility
// Resizes + re-encodes an image file to a compressed JPEG before upload.
// Targets ~50KB for result-slip photos (more aggressive than BGS scorecards).

const ImageCompress = {
  DEFAULT_MAX_WIDTH: 1280,
  DEFAULT_QUALITY: 0.7,
  TARGET_BYTES: 50 * 1024,
  MIN_QUALITY: 0.28,
  MIN_WIDTH: 640,

  /**
   * @param {File} file
   * @param {{ maxWidth?: number, quality?: number, targetBytes?: number }} [options]
   * @returns {Promise<{ base64: string, mimeType: string, byteLength: number }>}
   */
  compressImage: function (file, options) {
    var maxWidth = (options && options.maxWidth) || this.DEFAULT_MAX_WIDTH;
    var quality = (options && options.quality) != null ? options.quality : this.DEFAULT_QUALITY;
    var targetBytes = (options && options.targetBytes) || this.TARGET_BYTES;
    var self = this;

    return this._readFileAsDataUrl(file)
      .then(function (dataUrl) {
        return self._compressToTarget(dataUrl, maxWidth, quality, targetBytes);
      })
      .catch(function (err) {
        console.warn('ImageCompress: falling back to uncompressed file:', err);
        return self._readFileAsDataUrl(file).then(function (dataUrl) {
          var parts = String(dataUrl).split(',');
          var mimeMatch = /^data:([^;]+);base64$/.exec(parts[0] || '');
          var base64 = parts[1] || '';
          return {
            base64: base64,
            mimeType: (mimeMatch && mimeMatch[1]) || file.type || 'image/jpeg',
            byteLength: Math.floor((base64.length * 3) / 4),
          };
        });
      });
  },

  _readFileAsDataUrl: function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(reader.error || new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  },

  _blobToBase64: function (blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = function () {
        reject(reader.error || new Error('Failed to encode blob'));
      };
      reader.readAsDataURL(blob);
    });
  },

  _drawResizedBlob: function (img, maxWidth, quality) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var scale = Math.min(1, maxWidth / (img.width || maxWidth));
      var width = Math.max(1, Math.round(img.width * scale));
      var height = Math.max(1, Math.round(img.height * scale));
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        function (blob) {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        quality
      );
    });
  },

  _loadImage: function (dataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        reject(new Error('Failed to load image for compression'));
      };
      img.src = dataUrl;
    });
  },

  _compressToTarget: function (dataUrl, startWidth, startQuality, targetBytes) {
    var self = this;
    return this._loadImage(dataUrl).then(function (img) {
      var widths = [startWidth, 1024, 800, self.MIN_WIDTH];
      var qualities = [startQuality, 0.55, 0.4, 0.3, self.MIN_QUALITY];
      var best = null;
      var wi = 0;

      function tryNext() {
        if (wi >= widths.length) {
          if (!best) return Promise.reject(new Error('Compression produced no output'));
          return self._blobToBase64(best).then(function (base64) {
            return {
              base64: base64,
              mimeType: 'image/jpeg',
              byteLength: best.size,
            };
          });
        }
        var width = widths[wi];
        var qi = 0;

        function tryQuality() {
          if (qi >= qualities.length) {
            wi += 1;
            return tryNext();
          }
          var quality = qualities[qi];
          qi += 1;
          return self._drawResizedBlob(img, width, quality).then(function (blob) {
            if (!best || blob.size < best.size) best = blob;
            if (blob.size <= targetBytes) {
              return self._blobToBase64(blob).then(function (base64) {
                return {
                  base64: base64,
                  mimeType: 'image/jpeg',
                  byteLength: blob.size,
                };
              });
            }
            return tryQuality();
          });
        }

        return tryQuality();
      }

      return tryNext();
    });
  },
};

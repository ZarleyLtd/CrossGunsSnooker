// Result Slip Photo Upload Component
// Button + action sheet used by the Enter Result dialog to attach a photo of
// the signed paper result slip. Handles UI only; network calls are driven by
// FixturesPage via the callbacks passed to init().

const ResultSlipUpload = {
  _buttonEl: null,
  _callbacks: null,
  _cameraInput: null,
  _galleryInput: null,
  _overlayEl: null,
  _lightboxEl: null,
  _lightboxKeydownHandler: null,
  _hasImage: false,
  _currentImageUrl: null,

  /**
   * @param {HTMLElement} buttonEl
   * @param {{ onPhotoSelected: (base64: string, mimeType: string, previewUrl: string) => void,
   *           onRemoveRequested: () => void }} callbacks
   */
  init: function (buttonEl, callbacks) {
    if (!buttonEl) return;
    this._buttonEl = buttonEl;
    this._callbacks = callbacks || {};
    this._hasImage = false;

    this._renderButtonContents();
    this._createHiddenInputs();

    buttonEl.setAttribute('type', 'button');
    buttonEl.setAttribute('aria-label', 'View or attach a photo of the result slip');
    buttonEl.addEventListener('click', () => {
      if (this._hasImage) {
        this._openLightbox();
      } else {
        this._openPickerMenu();
      }
    });
  },

  /** Show a persisted/preview image on the button. */
  setImage: function (url) {
    if (!this._buttonEl || !url) return;
    this._hasImage = true;
    this._currentImageUrl = url;
    var img = this._buttonEl.querySelector('.result-slip-btn__thumb');
    var icon = this._buttonEl.querySelector('.result-slip-btn__icon');
    if (img) {
      img.src = url;
      img.style.display = 'block';
    }
    if (icon) icon.style.display = 'none';
    this._buttonEl.classList.add('result-slip-btn--has-image');
  },

  /** Reset the button back to the camera-icon state. */
  clearImage: function () {
    if (!this._buttonEl) return;
    this._hasImage = false;
    this._currentImageUrl = null;
    var img = this._buttonEl.querySelector('.result-slip-btn__thumb');
    var icon = this._buttonEl.querySelector('.result-slip-btn__icon');
    if (img) {
      img.removeAttribute('src');
      img.style.display = 'none';
    }
    if (icon) icon.style.display = '';
    this._buttonEl.classList.remove('result-slip-btn--has-image');
  },

  setBusy: function (isBusy) {
    if (!this._buttonEl) return;
    this._buttonEl.disabled = !!isBusy;
    var spinner = this._buttonEl.querySelector('.result-slip-btn__spinner');
    if (spinner) spinner.style.display = isBusy ? 'flex' : 'none';
  },

  _renderButtonContents: function () {
    this._buttonEl.innerHTML =
      '<span class="result-slip-btn__icon" aria-hidden="true">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>' +
      '<circle cx="12" cy="13" r="4"/>' +
      '</svg>' +
      '</span>' +
      '<img class="result-slip-btn__thumb" alt="Result slip photo" style="display:none;">' +
      '<span class="result-slip-btn__spinner" style="display:none;"><span class="spinner"></span></span>';
  },

  _createHiddenInputs: function () {
    if (this._cameraInput) return;
    this._cameraInput = document.createElement('input');
    this._cameraInput.type = 'file';
    this._cameraInput.accept = 'image/*';
    this._cameraInput.setAttribute('capture', 'environment');
    this._cameraInput.className = 'result-slip-file-input';
    this._cameraInput.addEventListener('change', (e) => this._handleFileChosen(e));

    this._galleryInput = document.createElement('input');
    this._galleryInput.type = 'file';
    this._galleryInput.accept = 'image/*';
    this._galleryInput.className = 'result-slip-file-input';
    this._galleryInput.addEventListener('change', (e) => this._handleFileChosen(e));

    document.body.appendChild(this._cameraInput);
    document.body.appendChild(this._galleryInput);
  },

  /**
   * Mount overlays inside the open Enter Result <dialog> so they sit in the
   * same browser top layer (body overlays render behind showModal dialogs).
   */
  _overlayMountParent: function () {
    var dlg = document.getElementById('fixture-result-dialog');
    if (dlg && (dlg.open || dlg.hasAttribute('open'))) return dlg;
    return document.body;
  },

  _openPickerMenu: function () {
    this._closeMenu();

    var overlay = document.createElement('div');
    overlay.className = 'result-slip-menu-overlay';

    var card = document.createElement('div');
    card.className = 'result-slip-menu-card';

    var takeBtn = document.createElement('button');
    takeBtn.type = 'button';
    takeBtn.className = 'result-slip-menu-btn';
    takeBtn.textContent = 'Take Photo';
    takeBtn.addEventListener('click', () => {
      this._closeMenu();
      this._cameraInput.click();
    });
    card.appendChild(takeBtn);

    var galleryBtn = document.createElement('button');
    galleryBtn.type = 'button';
    galleryBtn.className = 'result-slip-menu-btn';
    galleryBtn.textContent = 'Choose from Gallery';
    galleryBtn.addEventListener('click', () => {
      this._closeMenu();
      this._galleryInput.click();
    });
    card.appendChild(galleryBtn);

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'result-slip-menu-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this._closeMenu());
    card.appendChild(cancelBtn);

    overlay.appendChild(card);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._closeMenu();
    });
    this._overlayMountParent().appendChild(overlay);
    this._overlayEl = overlay;
  },

  _closeMenu: function () {
    if (this._overlayEl && this._overlayEl.parentNode) {
      this._overlayEl.parentNode.removeChild(this._overlayEl);
    }
    this._overlayEl = null;
  },

  _openLightbox: function () {
    this._closeLightbox();
    if (!this._currentImageUrl) {
      this._openPickerMenu();
      return;
    }

    var overlay = document.createElement('div');
    overlay.className = 'result-slip-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Result slip photo');

    var content = document.createElement('div');
    content.className = 'result-slip-lightbox__content';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'result-slip-lightbox__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this._closeLightbox());
    content.appendChild(closeBtn);

    var img = document.createElement('img');
    img.className = 'result-slip-lightbox__img';
    img.alt = 'Result slip photo';
    img.src = this._currentImageUrl;
    content.appendChild(img);

    var actions = document.createElement('div');
    actions.className = 'result-slip-lightbox__actions';

    var replaceBtn = document.createElement('button');
    replaceBtn.type = 'button';
    replaceBtn.className = 'result-slip-menu-btn';
    replaceBtn.textContent = 'Replace Photo';
    replaceBtn.addEventListener('click', () => {
      this._closeLightbox();
      this._openPickerMenu();
    });
    actions.appendChild(replaceBtn);

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'result-slip-menu-btn result-slip-menu-btn--danger';
    removeBtn.textContent = 'Remove Photo';
    removeBtn.addEventListener('click', () => {
      this._closeLightbox();
      if (this._callbacks.onRemoveRequested) this._callbacks.onRemoveRequested();
    });
    actions.appendChild(removeBtn);

    content.appendChild(actions);
    overlay.appendChild(content);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._closeLightbox();
    });

    var onKeydown = (e) => {
      if (e.key === 'Escape') this._closeLightbox();
    };
    document.addEventListener('keydown', onKeydown);
    this._lightboxKeydownHandler = onKeydown;

    this._overlayMountParent().appendChild(overlay);
    this._lightboxEl = overlay;
  },

  _closeLightbox: function () {
    if (this._lightboxEl && this._lightboxEl.parentNode) {
      this._lightboxEl.parentNode.removeChild(this._lightboxEl);
    }
    this._lightboxEl = null;
    if (this._lightboxKeydownHandler) {
      document.removeEventListener('keydown', this._lightboxKeydownHandler);
      this._lightboxKeydownHandler = null;
    }
  },

  _handleFileChosen: function (e) {
    var input = e.target;
    var file = input.files && input.files[0];
    input.value = '';
    if (!file) return;

    this.setBusy(true);
    var self = this;
    var compress =
      typeof ImageCompress !== 'undefined'
        ? ImageCompress.compressImage(file)
        : Promise.reject(new Error('ImageCompress not available'));

    compress
      .then(function (result) {
        var previewUrl = 'data:' + result.mimeType + ';base64,' + result.base64;
        self.setImage(previewUrl);
        self.setBusy(false);
        if (self._callbacks.onPhotoSelected) {
          self._callbacks.onPhotoSelected(result.base64, result.mimeType, previewUrl);
        }
      })
      .catch(function (err) {
        console.error('Failed to process result slip photo:', err);
        self.setBusy(false);
        if (typeof BriefMessage === 'function') {
          BriefMessage('Unable to process that photo', self._buttonEl);
        }
      });
  },
};

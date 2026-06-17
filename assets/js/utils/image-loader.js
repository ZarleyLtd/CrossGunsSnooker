// Image Loading Utility
// Adds loaded class to images for styling purposes

const ImageLoader = {
  markLoaded: function(img) {
    img.classList.add('is-loaded');
  },
  init: function() {
    const images = document.querySelectorAll('img[loading]');
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (img.complete) {
        this.markLoaded(img);
      } else {
        img.addEventListener('load', function() {
          ImageLoader.markLoaded(this);
        }, false);
        img.addEventListener('error', function() {
          ImageLoader.markLoaded(this);
        }, false);
      }
    }
  }
};
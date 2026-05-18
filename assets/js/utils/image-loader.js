// Image Loading Utility
// Adds loaded class to images for styling purposes

const ImageLoader = {
  init: function() {
    const images = document.querySelectorAll('img[loading]');
    for (let i = 0; i < images.length; i++) {
      if (images[i].complete) {
        images[i].classList.add('is-loaded');
      } else {
        images[i].addEventListener(
          'load',
          function() {
            this.classList.add('is-loaded');
          },
          false
        );
      }
    }
  }
};
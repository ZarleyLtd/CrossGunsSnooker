/**
 * Sets the active class on the navigation menu item that matches the current page
 */
(function() {
  function setActiveNavItem() {
    // Get the current page filename
    const pathParts = window.location.pathname.split('/');
    const currentPage = pathParts[pathParts.length - 1] || 'index.html';
    
    // Handle root/home page
    const isHomePage = currentPage === '' || currentPage === 'index.html' || pathParts[pathParts.length - 1] === '';
    
    // Find all navigation links
    const navLinks = document.querySelectorAll('.navbar__menu li a');
    
    if (navLinks.length === 0) {
      return; // Navigation not loaded yet
    }
    
    // Remove any existing active classes first
    navLinks.forEach(link => {
      if (link.parentElement) {
        link.parentElement.classList.remove('active');
      }
    });
    
    // Add active class to the matching link
    navLinks.forEach(link => {
      const linkHref = link.getAttribute('href');
      
      // Match exact filename
      if (linkHref === currentPage) {
        if (link.parentElement) {
          link.parentElement.classList.add('active');
        }
        return;
      }
      
      // Handle home/index page
      if (isHomePage && (linkHref === 'index.html' || linkHref === './index.html')) {
        if (link.parentElement) {
          link.parentElement.classList.add('active');
        }
      }
    });
  }
  
  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setActiveNavItem);
  } else {
    // DOM already loaded
    setActiveNavItem();
  }
})();

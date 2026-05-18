/**
 * Debug utility to log navbar positioning information
 */
(function() {
  function logNavbarLayout() {
    const pageName = window.location.pathname.split('/').pop() || 'index.html';
    const topEl = document.querySelector('.top');
    const navbarEl = document.querySelector('.navbar');
    const toggleEl = document.querySelector('.navbar__toggle');
    const logoEl = document.querySelector('.logo');
    
    if (!topEl || !navbarEl || !toggleEl || !logoEl) {
      fetch('http://127.0.0.1:7242/ingest/8d61ca83-597f-4d33-92f2-1d552a43a597',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'nav-debug.js:19',message:'Elements missing',data:{pageName,hasTop:!!topEl,hasNavbar:!!navbarEl,hasToggle:!!toggleEl,hasLogo:!!logoEl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      return;
    }
    
    const topStyles = window.getComputedStyle(topEl);
    const navbarStyles = window.getComputedStyle(navbarEl);
    const toggleStyles = window.getComputedStyle(toggleEl);
    const logoStyles = window.getComputedStyle(logoEl);
    
    const topRect = topEl.getBoundingClientRect();
    const navbarRect = navbarEl.getBoundingClientRect();
    const toggleRect = toggleEl.getBoundingClientRect();
    const logoRect = logoEl.getBoundingClientRect();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8d61ca83-597f-4d33-92f2-1d552a43a597',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'nav-debug.js:36',message:'Top container computed styles',data:{pageName,display:topStyles.display,justifyContent:topStyles.justifyContent,alignItems:topStyles.alignItems,width:topRect.width,height:topRect.height,right:topRect.right,left:topRect.left},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8d61ca83-597f-4d33-92f2-1d552a43a597',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'nav-debug.js:39',message:'Navbar computed styles',data:{pageName,display:navbarStyles.display,justifyContent:navbarStyles.justifyContent,alignItems:navbarStyles.alignItems,width:navbarRect.width,height:navbarRect.height,right:navbarRect.right,left:navbarRect.left,order:navbarStyles.order},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8d61ca83-597f-4d33-92f2-1d552a43a597',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'nav-debug.js:42',message:'Toggle button computed styles',data:{pageName,display:toggleStyles.display,position:toggleStyles.position,right:toggleStyles.right,left:toggleStyles.left,marginLeft:toggleStyles.marginLeft,flexShrink:toggleStyles.flexShrink,width:toggleRect.width,height:toggleRect.height,right:toggleRect.right,left:toggleRect.left,rightFromViewport:window.innerWidth-toggleRect.right},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8d61ca83-597f-4d33-92f2-1d552a43a597',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'nav-debug.js:45',message:'Logo computed styles',data:{pageName,display:logoStyles.display,marginRight:logoStyles.marginRight,width:logoRect.width,height:logoRect.height,right:logoRect.right,order:logoStyles.order},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8d61ca83-597f-4d33-92f2-1d552a43a597',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'nav-debug.js:48',message:'Layout relationships',data:{pageName,viewportWidth:window.innerWidth,toggleDistanceFromRight:window.innerWidth-toggleRect.right,navbarDistanceFromRight:window.innerWidth-navbarRect.right,spaceBetweenLogoAndNavbar:navbarRect.left-logoRect.right},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    // Check if menu is active
    const isActive = toggleEl.classList.contains('is-active');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8d61ca83-597f-4d33-92f2-1d552a43a597',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'nav-debug.js:53',message:'Menu state',data:{pageName,isActive,hasActiveClass:toggleEl.classList.contains('is-active'),ariaExpanded:toggleEl.getAttribute('aria-expanded')},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Check media query state
    const isMobile = window.matchMedia('(max-width: 56.1875em)').matches;
    const isDesktop = window.matchMedia('(min-width: 56.25em)').matches;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8d61ca83-597f-4d33-92f2-1d552a43a597',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'nav-debug.js:58',message:'Media query state',data:{pageName,viewportWidth:window.innerWidth,isMobile,isDesktop,mobileBreakpoint:'56.1875em',desktopBreakpoint:'56.25em'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    // Check if relatedContainer has class added by menu script
    const relatedContainer = document.querySelector('.top');
    const hasVisibleClass = relatedContainer ? relatedContainer.classList.contains('is-visible') : false;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8d61ca83-597f-4d33-92f2-1d552a43a597',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'nav-debug.js:64',message:'Related container classes',data:{pageName,topClasses:relatedContainer?Array.from(relatedContainer.classList).join(','):'none',hasVisibleClass},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  }
  
  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(logNavbarLayout, 100);
      // Also log after menu opens
      const toggleBtn = document.querySelector('.navbar__toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
          setTimeout(logNavbarLayout, 300);
        });
      }
    });
  } else {
    setTimeout(logNavbarLayout, 100);
    const toggleBtn = document.querySelector('.navbar__toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function() {
        setTimeout(logNavbarLayout, 300);
      });
    }
  }
})();

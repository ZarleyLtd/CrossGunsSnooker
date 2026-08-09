// Rules page — collapse open sections when the expanded body is clicked;
// if the section header was above the viewport, scroll it back to the top.
const RulesPage = {
  init: function () {
    var root = document.querySelector('.rules-page');
    if (!root) return;

    root.querySelectorAll('.rules-section').forEach(function (details) {
      var headerWasAbove = false;

      details.addEventListener('click', function (event) {
        if (!details.open) return;

        var summary = details.querySelector('summary');
        var inSummary = event.target.closest('summary');
        var inBody = event.target.closest('.rules-section__body');
        if (!inSummary && !inBody) return;

        headerWasAbove = summary.getBoundingClientRect().top < 0;

        if (inBody && !inSummary) {
          details.open = false;
        }
      });

      details.addEventListener('toggle', function () {
        if (details.open || !headerWasAbove) {
          headerWasAbove = false;
          return;
        }
        headerWasAbove = false;
        var summary = details.querySelector('summary');
        // After layout settles from collapsing tall content
        requestAnimationFrame(function () {
          summary.scrollIntoView({ block: 'start', behavior: 'auto' });
        });
      });
    });
  }
};

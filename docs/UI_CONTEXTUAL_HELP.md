# Contextual help (this project)

Tap **?**, then tap a control. That tap does not run the control. A popover explains the feature, never a particular player, match, or score.

- **Canonical spec:** [`../../cursor-sites-shared/ui/CONTEXTUAL_HELP.md`](../../cursor-sites-shared/ui/CONTEXTUAL_HELP.md)
- **Engine:** [`../assets/js/components/contextual-help.js`](../assets/js/components/contextual-help.js) (`ContextualHelp.init()` from `main.js`)
- **Styles:** [`../assets/css/contextual-help.css`](../assets/css/contextual-help.css) (imported from `style.css`)
- **Catalog:** [`../assets/js/utils/help-catalog.js`](../assets/js/utils/help-catalog.js) (`window.CrossGunsHelpCatalog`)

The **?** button is in the page header, and again on each dialog, admin sheet, and result-slip overlay that covers the header. Topic keys live in `data-help`. Page fallbacks use `body[data-page]`.

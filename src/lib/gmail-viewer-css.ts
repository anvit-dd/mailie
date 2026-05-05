export const EMAIL_VIEWER_CSS = `
  /* 
   * Minimal viewer reset. 
   * 
   * The email is an isolated HTML document — its own inline styles, bgcolor 
   * attributes, and font tags are the SOLE authority on how it looks.
   * 
   * This CSS only exists to:
   *   1. Reset browser defaults (margin/padding) so raw email HTML renders cleanly
   *   2. Prevent OS/browser dark mode from inverting email colors via color-scheme
   *   3. Set a white background ONLY on <body> — for emails that set zero background.
   *      We don't touch .email-body, td, th, div, or any other element because
   *      doing so cascades and corrupts nested table structures (like Wellfound's
   *      dark header → white card layout).
   */

  html, body {
    height: 100%;
    margin: 0;
    padding: 0;
    /* Prevent OS-level dark mode from inverting the email's colors */
    color-scheme: light;
  }

  body {
    background: #ffffff;
    /* Only set these so raw text in an email without ANY styling is readable.
     * font-family and font-size are intentionally generic — email's inline styles 
     * override these when present. */
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 16px;
    line-height: 1.5;
    color: #000000;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  /* Leave everything else alone. Tables, tds, divs, fonts, centers —
   * the email's own bgcolor attributes and inline styles decide their appearance.
   * We do NOT cascade anything. */
`

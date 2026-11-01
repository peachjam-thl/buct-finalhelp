# Third-party components

The quiz includes KaTeX 0.19.1 under the MIT License. Its browser library, styles and WOFF2 fonts are bundled locally so the exported page can render mathematics without a CDN or network connection.

- Upstream: https://katex.org/
- Source package and integrity: `skills/buct-finalhelp/assets/quiz-app/vendor/katex/version.json`
- License: `skills/buct-finalhelp/assets/quiz-app/vendor/katex/LICENSE`

KaTeX is configured with `trust: false`, bounded macro expansion and fresh macros for each expression. Untrusted ordinary text is added as text nodes rather than HTML.

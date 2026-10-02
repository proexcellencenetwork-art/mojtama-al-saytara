# Font and performance asset sources

## Tajawal

- Upstream font project: https://github.com/googlefonts/tajawal
- Font metadata, available weights, and license text: https://fontsource.org/fonts/tajawal/about
- Pinned webfont package used by `scripts/vendor-tajawal-font.mjs`: https://www.npmjs.com/package/@fontsource/tajawal (version `5.3.0`)
- Fontsource's package CSS provides the Arabic and Latin Unicode ranges copied into `src/fonts.css`; only WOFF2 subsets at weights 400, 500, 700, and 800 are included. The browser selects the nearest included face for CSS weight 600.
- The font is licensed under the SIL Open Font License 1.1. The complete license is bundled at `public/fonts/OFL.txt`.

## Original brand image

- Responsive WebP and AVIF files are generated locally from the project's original `public/og-social.png` using `scripts/optimize-public-images.sh`; no stock image source is used.

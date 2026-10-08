# Web app installation

`public/manifest.json` supplies the name, standalone launch mode, colors and install icons. `index.html` links the manifest, SVG/PNG favicons and Apple touch icon through Vite's `%BASE_URL%`. The original pump-and-map icon source is `public/icons/icon.svg`; its essential artwork fits inside the central maskable safe circle. All PNGs have opaque backgrounds.

The manifest's relative launch URL, scope and icon paths resolve within the deployment containing it. The optional `id` is deliberately omitted so identity defaults to the resolved launch URL (an explicit relative ID would resolve against the origin instead). A walkable installation therefore launches `/vr-snow/walkable/`, while a build at `/vr-snow/` uses that root and a distinct app ID. These additions are currently on the walkable branch; the separately built `main` site only gains them when the changes are brought into that branch.

On a supporting browser, use its install/add-app menu after opening the deployed HTTPS site. The precise menu and library integration depend on the browser and platform; verify saving and relaunching on Quest after deployment. A manifest does not publish an app to the Meta Horizon Store. Store distribution requires Meta's separate packaging and submission process.

The game still requires a network connection. No offline service worker or asset cache is added, so installation does not cache the large scenes or change the existing update behavior. Modern manifest-based installation does not require a service worker.

## Verification and icon authoring

Run `npm run test:web-app`. To check a built deployment, run `node scripts/test-web-app.mjs dist /vr-snow/walkable/` (use the base path passed to Vite).

The PNGs are committed, so normal builds need no image tooling. To regenerate after editing the SVG, install the optional authoring tool outside the project and run:

```sh
npm install --prefix /tmp/vr-snow-icons sharp
NODE_PATH=/tmp/vr-snow-icons/node_modules node scripts/assets/build_app_icons.mjs
```

References: [MDN installability requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [Meta PWA packaging](https://developers.meta.com/vr/documentation/web/pwa-overview-gs/).

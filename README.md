# R.E.D. — Realm of Eternal Dragons

The Forgotten Valley is a playable, single-player 3D fantasy exploration prototype.

**Play:** [https://taydavis1990-droid.github.io/Red/](https://taydavis1990-droid.github.io/Red/)

The game source and local development instructions are in [RED/README.md](RED/README.md).

## Local development

The Vite project is in `RED/`. Start its development server from that directory:

```sh
cd RED
npm run dev
```

Open the URL Vite prints in the terminal. In Codespaces, open the matching forwarded port from the VS Code **Ports** tab. Do not use port `5500` or a static file server from the repository root.

## Publishing

GitHub Actions builds the Vite app in `RED/` and deploys it to GitHub Pages whenever changes are pushed to `main`. You can also start a deployment manually from the repository's **Actions → Deploy RED to GitHub Pages → Run workflow** page.

The game supports touch controls and responsive mobile layouts. See [RED/README.md](RED/README.md#controls) for keyboard and touch controls.

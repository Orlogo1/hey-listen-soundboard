# Hey! Listen! Pocket Fairy

A small, mobile-first soundboard with an original fantasy-forest interface. The supplied `hey-listen.wav` is bundled as a permanent offline-ready option; no official game artwork is included.

## Add your audio

The supplied soundbite is the default. The sound-library dropdown lists bundled website audio, the synthesized demo chime, and every local audio file saved in that browser. Local files are stored in IndexedDB and remain available offline on that device.

To add another bundled choice, place its file in `dist/assets/` and add its name, ID, and relative path to `dist/sounds.json`. The dropdown reads that catalog automatically.

## Preview locally

Serve the `dist` directory with any static web server. Service workers and install prompts require `localhost` or HTTPS.

## GitHub Pages

The included `.github/workflows/pages.yml` workflow publishes `dist/` whenever `main` changes. In **Settings → Pages**, set the source to **GitHub Actions** once; later pushes deploy automatically.

All browser assets use relative paths, so the site works from a GitHub Pages project subdirectory.


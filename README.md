# 3DParticleLab

## Overview

3DParticleLab is a web-based 3D particle system project. It provides an interactive visualization of particles in a 3D environment powered by modern web technologies including Vite and WebGL (likely Three.js or similar).

## Features

- Real-time 3D particle rendering
- Built with modern tooling and fast bundler
- Structured for extension and experimentation

## Requirements

- Node.js (version 14 or newer)
- npm or Yarn
- Web browser with WebGL support

## Install Dependencies

1. Clone this repository:

   ```bash
   git clone https://github.com/cappiavi/3DParticleLab.git

2. Navigate into the project directory:

   ```bash
   cd 3DParticleLab
   ```

3. Install packages:

   ```bash
   npm install
   ```

   Or with Yarn:

   ```bash
   yarn
   ```

## Run Locally

1. Start the development server:

   ```bash
   npm run dev
   ```

   Or with Yarn:

   ```bash
   yarn dev
   ```

2. Open your browser and go to:

   ```
   http://localhost:3000
   ```

## Build for Production

```bash
npm run build
```

Or with Yarn:

```bash
yarn build
```

Build output will be placed in the `dist/` directory, ready for deployment.

## Deployment

Deploy the `dist/` folder to any static hosting service (GitHub Pages, Netlify, Vercel, Cloudflare, etc.).

## Project Structure

| Folder/File      | Purpose                                   |
| ---------------- | ----------------------------------------- |
| `src/`           | Source code (components, scripts, styles) |
| `index.html`     | Main HTML entry                           |
| `vite.config.ts` | Vite configuration                        |
| `package.json`   | Dependencies and scripts                  |

## Customize & Extend

* Add or tweak shaders in the `src/` folder
* Modify particle behavior in the main script
* Integrate UI controls for interactive parameters

## License

MIT License

```
MIT License

Copyright (c) 2025 Khert Laguna Garde / cappiavi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

```
```

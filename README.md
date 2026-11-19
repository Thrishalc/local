# Skybound

A dependency-free 2D endless runner built with HTML Canvas and the Web Audio API.

## Play locally

Open `index.html` in a modern browser, or serve this directory with any static file server. Press **Space** or **Up Arrow** to jump. Collect coins for 100 points and avoid the obstacles.

The jump, coin, and game-over sounds are synthesized with Web Audio. Audio starts after the first user interaction, as required by browser autoplay policies. Your top five scores are stored as JSON in this browser's local storage; they are not uploaded or shared between browsers.

## Publish

The game is static and can be hosted on GitHub Pages or any static web host. For GitHub Pages, push these files to a repository and enable Pages for the branch and folder containing `index.html`. No build step or server-side service is required.

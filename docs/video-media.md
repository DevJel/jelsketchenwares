# Jels Kitchenwares video media

## Frame sizing and full-bleed video fit

- The hero uses its original responsive 4:3 frame. Its frame height follows the aspect ratio instead of forcing an oversized minimum height.
- The six product-card video frames retain their original 4:3 aspect ratio on desktop and mobile.
- Recipe video frames are square (1:1) on every screen size. Native video fills the square with `object-fit: cover`; the fallback player iframe is enlarged to 177.7778% width and centered with a -38.8889% left offset, cropping the widescreen player to fill the square frame edge-to-edge.
- Each frame clips overflow with rounded corners. The Cloudinary player iframe is enlarged horizontally to 133.3334% of the 4:3 frame width, positioned at -16.6667% from the left, and kept at 100% frame height. This gives the embedded 16:9 player a full-bleed crop across the 4:3 frame.
- The video remains centered and fills the frame; excess horizontal content is cropped rather than leaving black bars or empty side spaces. (The Cloudinary iframe is now only the fallback player; see Playback behavior.)
- The separate four-video gallery below the hero has been removed.
- Product videos are assigned one-to-one: each product card has its own source, with no repeated clip between cards.
- Video media remains muted, autoplaying, looping and non-interactive. Product details and purchase actions remain separate controls.

## Product source assignments

| Product | Video source |
|---|---|
| Clear Glass Pan 24cm | Glass video 3 |
| Glass Pot 3.5L | Glass Pot 3.5L product clip |
| Glass Mixing Bowl Trio | Glass video 4 |
| Glass Bake & Serve Set | Bake & Serve / Teapot product clip |
| Glass Storage Jars Set of 3 | Glass video 1 |
| Glass Teapot 1.2L | Glass video 2 |

The hero feature keeps its own separate steaming glass pan clip, so it is not repeated in the product range.

## Playback behavior

Clips are native `<video>` elements, not the Cloudinary player iframe. Native video is what phones allow to autoplay reliably.

- Each clip is `muted`, `loop` and `playsinline` with controls off. The muted state and inline attributes are also set in code, because iPhone and iPad refuse autoplay without them and React does not always write `muted` to the markup.
- Sources are delivered from Cloudinary (`res.cloudinary.com/<cloud>/video/upload/...`), derived from the same cloud name and public ID as before: first a phone-sized H.264 MP4 (`f_mp4,vc_h264,ac_none,q_auto,w_720,c_limit`, no audio track), then the original file as an MP4.
- A still frame from the clip (`so_0`) is the poster, so a blocked clip shows the product image instead of an empty box.
- A clip plays only while at least 15% of it is on screen, and pauses when it scrolls away or the tab is hidden. This keeps a phone from decoding seven videos at once, and saves battery and data. Clips below the fold do not download until they are needed (`preload="none"`).
- If the phone blocks autoplay (iPhone Low Power Mode, data saver), the clips stay on their poster frame and start on the first tap, key press or click anywhere on the page.
- If a source fails to load, the next one is tried. If all fail, that clip falls back to the previous Cloudinary player iframe (autoplay, muted, loop, `playsinline`, `allow="autoplay; encrypted-media"`).
- The 16:9 clip fills the 4:3 frame with `object-fit: cover`, which gives the same full-bleed crop as before without the oversized iframe.
- Video surfaces do not intercept clicks; product controls remain usable.

## Verification

The repository's verification workflow checks the HTML document and embedded JavaScript syntax. Browser testing is still required to confirm the hero and product-card dimensions, video loading, autoplay behavior and mobile layout on target devices. Mobile browsers may apply their own power-saving or autoplay policies.

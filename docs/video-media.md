# Jels Kitchenwares video media

## Frame sizing and full-bleed video fit

- The hero uses its original responsive 4:3 frame. Its frame height follows the aspect ratio instead of forcing an oversized minimum height.
- The six product-card video frames retain their original 4:3 aspect ratio on desktop and mobile.
- Each frame clips overflow with rounded corners. The Cloudinary player iframe is enlarged horizontally to 133.3334% of the 4:3 frame width, positioned at -16.6667% from the left, and kept at 100% frame height. This gives the embedded 16:9 player a full-bleed crop across the 4:3 frame.
- The video remains centered and fills the frame; excess horizontal content is cropped rather than leaving black bars or empty side spaces.
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

- Product embeds use Cloudinary's hosted player iframe with autoplay, muted, loop and controls disabled.
- The Cloudinary player also receives `player[playsinline]=true`, which requests inline playback on iOS and supports muted autoplay without forcing fullscreen.
- The iframe grants autoplay permission through `allow="autoplay; encrypted-media"`. Muted autoplay is requested on all screen sizes, but cannot be guaranteed when a browser or device blocks autoplay (for example, Low Power Mode or data-saving restrictions).
- The iframe crop is applied by sizing and positioning the player inside the clipped frame; the frame itself keeps its intended dimensions.
- Video surfaces do not intercept clicks; product controls remain usable.
- Lazy loading remains enabled for product cards below the fold.

## Verification

The repository's verification workflow checks the HTML document and embedded JavaScript syntax. Browser testing is still required to confirm the hero and product-card dimensions, video loading, autoplay behavior and mobile layout on target devices. Mobile browsers may apply their own power-saving or autoplay policies.

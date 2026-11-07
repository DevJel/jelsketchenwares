# Jels Kitchenwares video media

## Placement and original frame sizing

- The home-page hero retains its original 4:3 media frame, including the existing responsive minimum height.
- The video iframe fills the frame at 100% width and height with no artificial 116% enlargement or negative offset.
- The separate four-video gallery below the hero has been removed.
- The six product cards retain their original 4:3 video frames.
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
- The iframe uses the complete frame dimensions. The source is not enlarged or cropped by an additional iframe scale.
- Video surfaces do not intercept clicks; product controls remain usable.
- Lazy loading remains enabled for product cards below the fold.

## Verification

The repository's existing verification workflow checks the HTML document and embedded JavaScript syntax. Browser testing is still required to confirm the hero and product-card dimensions, video loading, autoplay behavior and mobile layout on target devices. Mobile browsers may apply their own power-saving or autoplay policies.

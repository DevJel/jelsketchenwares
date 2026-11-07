# Jels Kitchenwares video media

## Placement and layout

- The Shop home page keeps one large hero video alongside the headline.
- The previous three small repeated frames attached to the hero are removed.
- A separate **Glass, in motion** gallery sits between the hero feature/ticker and the product range.
- The gallery uses a two-column desktop layout and a single-column mobile layout. Each frame uses a 16:10 crop with `object-fit: cover`.
- The catalogue renders a video for all six product cards through the existing Cloudinary player helper. Product cards retain their product-specific video assignments.

## Gallery media

| Asset | Delivery URL |
|---|---|
| Glass video 1 | https://res.cloudinary.com/durqetaph/video/upload/glass1.mp4 |
| Glass video 2 | https://res.cloudinary.com/durqetaph/video/upload/v1794075719/glass2.mp4 |
| Glass video 3 | https://res.cloudinary.com/durqetaph/video/upload/v1794075712/glass3.mp4 |
| Glass video 4 | https://res.cloudinary.com/durqetaph/video/upload/v1794076535/glass4_arfolq.mp4 |

## Playback behavior

- Gallery videos use native HTML video playback with autoplay, muted, loop and plays-inline enabled.
- Controls and picture-in-picture are disabled; the video surface does not respond to pointer input.
- Product embeds use Cloudinary's hosted player iframe with autoplay, muted, loop and controls disabled.
- Product embed frames are enlarged slightly within their frame to give a closer crop.
- The video elements are decorative media. Product details and purchase actions remain separate controls.

## Verification

The storefront's existing verification workflow checks the HTML document and JavaScript syntax after the changes. Browser testing is still required to confirm autoplay behavior on each target device; mobile browsers may apply their own power-saving or autoplay policies.

---
name: image-art-director
description: UI art director and web performance engineer for creating, selecting, and integrating high-value website imagery that strengthens visual design without unnecessary visual weight.
---

# Image Art Director

## Purpose

Create, select, and integrate website imagery that strengthens the visual design without adding unnecessary visual weight.

The agent must think like both:

* a UI art director
* a web performance engineer

The goal is not to maximize the number of images.

The goal is to create the **minimum set of high-value visual assets** required for the page.

---

# Core Rules

1. Never generate an image merely because the page has empty space.
2. Never use generic AI imagery when a simpler graphic, CSS treatment, icon, or SVG would communicate the idea better.
3. Every generated image must have a specific role in the page.
4. Match the existing design system:

   * colors
   * typography
   * lighting
   * composition
   * border radius
   * visual density
   * brand personality
5. Never generate an image before understanding the surrounding layout.
6. Prefer one excellent hero image over several mediocre decorative images.
7. Generate images with the final display dimensions and crop in mind.
8. Never put important textual information inside generated images when HTML text can be used instead.
9. Never use generated text inside images unless the design explicitly requires it.
10. Do not use an image when CSS, SVG, or HTML can produce the same result more efficiently.

---

# First Inspect the Website

Before generating anything, inspect:

* existing pages
* design system
* color tokens
* typography
* spacing
* existing images
* icons
* component library
* responsive breakpoints
* dark/light themes
* target audience
* brand positioning

Identify the visual language before creating assets.

---

# Image Inventory

For every page, create an internal inventory:

| Asset                | Role           |  Required? | Priority |
| -------------------- | -------------- | ---------: | -------: |
| Hero                 | Primary visual |     Yes/No | Critical |
| Product image        | Demonstration  |     Yes/No |     High |
| Feature illustration | Explanation    |     Yes/No |   Medium |
| Background           | Atmosphere     |     Yes/No |      Low |
| Decorative image     | Decoration     | Usually no |      Low |

Prefer eliminating low-value decorative assets.

---

# Decide Whether an Image Is Actually Needed

Use this decision tree:

## Use HTML/CSS when:

* it is a simple shape
* it is a gradient
* it is a border
* it is a shadow
* it is a geometric pattern
* it is a button
* it is a simple background effect
* it is a layout element

## Use SVG when:

* it is an icon
* it is a logo
* it is a diagram
* it is a simple illustration
* it requires scalability
* it is primarily geometric

## Use a raster image when:

* photographic realism is needed
* complex texture is needed
* detailed artwork is needed
* lighting and natural visual detail matter

## Generate an image when:

* the page genuinely benefits from original artwork
* stock imagery would look generic
* the visual is central to the product/story
* the required image is difficult to source
* a consistent branded visual language is needed

---

# Image Art Direction

For every generated image define:

* subject
* purpose
* composition
* camera/viewpoint
* focal point
* lighting
* color palette
* background
* negative space
* aspect ratio
* intended crop
* desktop composition
* mobile composition
* visual style

Example:

```text
Role:
Hero image for a developer tool landing page

Subject:
Laptop showing an AI coding agent

Composition:
Laptop positioned on right third

Focal point:
Editor interface

Negative space:
Left 45% reserved for HTML headline

Lighting:
Soft studio lighting

Palette:
Existing brand palette

Desktop:
16:9

Mobile:
4:5 crop with subject centered
```

---

# Prompt Construction

Do not write vague prompts such as:

"Make a beautiful modern technology image."

Instead construct prompts from:

```text
[subject]
+
[environment]
+
[composition]
+
[lighting]
+
[visual style]
+
[color system]
+
[aspect ratio]
+
[negative space requirements]
```

The prompt must be tied to the actual page design.

---

# Responsive Art Direction

Do not assume one image works optimally everywhere.

For important visual assets determine whether mobile requires:

* a different crop
* a different composition
* a different source image
* fewer details
* different focal positioning

Use `<picture>` when art direction requires different images for different viewport conditions.

Use `srcset` and `sizes` when the same image needs multiple resolutions.

---

# Image Integration

Every image must have:

* meaningful filename
* appropriate dimensions
* correct aspect ratio
* alt text when semantic
* explicit width/height or aspect-ratio
* responsive sizing
* appropriate loading priority

Example:

```html
<img
  src="/images/hero-800.webp"
  srcset="
    /images/hero-480.webp 480w,
    /images/hero-800.webp 800w,
    /images/hero-1200.webp 1200w
  "
  sizes="(max-width: 768px) 100vw, 50vw"
  width="1200"
  height="800"
  alt="AI coding assistant analyzing a software project"
  fetchpriority="high"
/>
```

---

# Loading Rules

Images visible in the initial viewport must be treated as critical resources.

Images below the fold should normally use:

```html
loading="lazy"
```

Do not lazy-load the primary LCP image unless there is a specific reason.

Always provide dimensions so image loading does not cause layout shifts.

---

# Asset Format

Prefer modern efficient formats where supported:

* AVIF
* WebP

Use PNG when:

* lossless transparency is required
* the asset is genuinely better represented as PNG

Use SVG for vector graphics.

Do not ship huge source-resolution images when the rendered size is much smaller.

---

# Image Generation Output

For every generated asset record:

```text
filename:
purpose:
display dimensions:
aspect ratio:
mobile behavior:
format:
alt text:
compression status:
```

---

# Visual Quality Check

After generating an image, inspect it at:

* actual desktop size
* actual mobile size
* 2x display density where relevant
* light theme
* dark theme if supported

Reject the asset when:

* focal point is wrong
* crop destroys meaning
* colors conflict with brand
* AI artifacts are visible
* subject is generic
* composition competes with text
* image does not justify its network cost

---

# Final Principle

Generate fewer images.

Each image must earn its place through one of:

* communication
* product explanation
* emotional impact
* brand identity
* visual hierarchy

Do not use imagery as filler.

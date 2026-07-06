# School Logos

These are the logos used by the mock organizations in the Education Hub system.

## Sunrise Academy
**File:** `logo-sunrise-academy.svg`

- Shield-shaped crest in navy blue (#1e3a5f) to royal blue (#2563eb) gradient
- Golden sun with 12 radiating rays at the center
- White open book symbol at the base
- "SA" initials overlaid on the sun
- Professional academic crest design

## Green Valley School
**File:** `logo-green-valley.svg`

- Circular badge in emerald green (#059669) to dark green (#065f46) gradient
- Layered tree with multi-tone green foliage (light to dark)
- Mountain/valley silhouettes in the background
- White open book at the base
- "GREEN VALLEY" text along the bottom
- Three gold accent stars at the top

## Usage

These logos are automatically deployed to the `uploads/` directory when running `npm run seed:mock`. They are then referenced by each organization's report card configuration.

### Where logos appear:
- **Report Card HTML View** — displayed next to the institute name in the header
- **Report Card Print** — printed in full color
- **Report Card PDF** — for SVG logos, a colored circle badge with initials is drawn (PDFKit limitation); for PNG/JPG uploads, the actual image is embedded

### Customizing Logos
Admins can upload their own logo (PNG, JPG, SVG — max 2MB) via:
1. Login as admin
2. Go to **Report Cards**
3. Click **Customize**
4. Use the **Upload Logo** button

Project Brief & Product Requirements Document (PRD)

APEX ATHLETIC — Luxury Tennis E-Commerce & Omnichannel Admin Platform



1. Executive Summary & Brand Pivot

APEX ATHLETIC is an elite sports fashion and equipment maison that has strategically evolved from a standard high-performance running brand into a prestigious, "quiet luxury" tennis brand inspired by the heritage, sartorial discipline, and timeless elegance of Wimbledon and vintage European racquet clubs.

This document serves as the single source of truth for both:





The Customer-Facing Storefront: An editorial, high-conversion e-commerce brand experience merging tennis whites, forest green accents, and athletic technical precision.



The Operations & Administration Console (HQ Admin Suite): A high-density, mission-critical back-office management ecosystem enabling product merchandising, digital asset/CDN delivery, editorial blog publishing, and global system configurations.



2. Brand Identity & Visual Language

Core Brand Principles





Quiet Luxury & Heritage: Pristine tennis whites, cream tones, deep Wimbledon Forest Green (#004225), and architectural charcoal typography.



Kinetic Precision: Highlighting technical engineering (microfiber weaves, lateral lockdown, multi-surface herringbone traction) balanced with sartorial tailoring.



Editorial Sophistication: Clean editorial layouts, generous whitespace, archival photography framing, and storytelling inspired by luxury monographs.

Design Tokens & Typography





Primary Typography: Modern, crisp sans-serif (Chivo / Inter) for UI controls, navigation, and technical data; paired with high-contrast serif accents (Playfair Display) for editorial titles.



Color Palette:





Surface / White: #ffffff, #f9f9f9, #f3f3f4



Accent / Wimbledon Heritage Green: #004225 (buttons, badges, active tabs, subtle borders)



Text / Charcoal: #131313, #1c1917



Muted / Secondary: #71717a, #9ca3af



Status Alerts: #ef4444 (Low stock/depleting), #10b981 (In stock/Synced), #f59e0b (Scheduled drops)



Form Factor: Desktop-first layout (1440px – 1600px container widths) with responsive grid adaptations.



3. Experience Pillars & System Architecture

                                  [ APEX ATHLETIC ECOSYSTEM ]
                                               │
             ┌─────────────────────────────────┴─────────────────────────────────┐
             ▼                                                                   ▼
   [ FRONT-FACING STOREFRONT ]                                         [ HQ ADMIN CONSOLE ]
   ├─ 1. Homepage (Grand Slam / Grass Season)                          ├─ 1. Homepage & Content Studio
   ├─ 2. Product Catalog & Collections                                 ├─ 2. Catalog & Product Suite (SKU Management)
   ├─ 3. Product Detail Page (Apex Court-V1 Prime)                     ├─ 3. Digital Asset Studio & CDN Vault
   └─ 4. Brand Experience (The Court Lab / Science of Swing)           ├─ 4. The Club Journal (Editorial CMS)
                                                                       └─ 5. System Configuration & Store Settings



4. Pillar 1: Storefront Experience Requirements

Screen 1: Homepage (Home (Tennis Light))





Hero Showcase: Full-bleed grass court visual backdrop featuring Wimbledon architecture, paired with the campaign headline "OWN THE COURT", dual CTAs ("Shop Collection", "Explore Tech"), and season tag "The Grass Season".



Curated Essentials Grid: Split-card modules highlighting key footwear series (Pro-Court Series) and equipment (Tour Racket Bags).



Latest Drops: 4-column product carousel showing pleated skirts, club performance polos, tour warm-up jackets, and tournament visors with instant price tags.



Editorial Brand Story ("Master the Game"): Side-by-side technical highlight featuring slow-motion athlete action, video trigger, and 3-part spec breakdown (Lightweight Breathability, Precision Tailoring, Four-Way Stretch).

Screen 2: Collections (The Court Collection)





Filter Rail: Granular faceted navigation by Category (Polos, Skirts, Shorts, Racquet Bags), Sizing (XS–XXL), and Colorways (White, Forest Green, Navy).



Curated Product Grid: High-aspect ratio editorial photography showcasing items on-court and flat-lay, tagged with status badges ("New", "Bestseller").



Batch Pagination: "Load More Collection" button with dynamic count indicators (e.g., 42 items found).

Screen 3: Product Detail Page (Apex Court-V1 Prime)





Multi-Angle Gallery: Primary high-resolution footwear macro shot paired with secondary sole traction and on-court clay/grass action photos.



Purchase Decision Matrix: Colorway selector swatches, US size grid with live stock state, size guide trigger, and primary action CTA ("Add to Cart").



Technical Specification Drawer: Bulleted engineering details (Outsole: Multi-Surface Herringbone; Stability: TPU Lateral Wing; Upper: Endurance Mesh Pro).



Feature Breakdown Section: 3-column iconography covering Lateral Lockdown, All-Court Traction, and Endurance Mesh.

Screen 4: Brand Experience (The Court Lab)





Monograph Hero: "Science of the Swing" campaign banner diving into kinematics and raw athletic precision.



Masonry Moodboard & Athlete Monograph: Mixed grid containing tournament photography, equipment close-ups, and pull quotes from Grand Slam champions ("Every point is a calculation. Every swing, a testament to physics.").



Category Segmentation: Filter tabs for All, Training, and Competition.



5. Pillar 2: HQ Admin Management Suite Requirements

Screen 5: Homepage & Content Studio (Admin | Content & Media Management)





Module 01 (Hero Showcase): Kicker, headline, subheadline, and primary/secondary CTA URL routing inputs with dual-language fields (English and Vietnamese). Integrated image replacement and hero crop frame.



Module 02 (Trending & Drop Slots): Drag-and-drop slot ordering for top trending items on the homepage with live SKU tags and pricing.



Module 03 (Brand Story Linkage): Dynamic linkage to published Club Journal editions with copy excerpt editors.



Live Viewport Simulator & Ingestion: Real-time 1080p storefront rendering alongside drag-and-drop file ingestion with automatic WebP conversion.

Screen 6: Catalog & Product Suite (Admin | Catalog & Products)





Operational Metrics: Real-time KPI summary (Total Active SKUs: 148, Wimbledon Drop SKUs: 24, Low Stock Alerts: 3, Draft Items: 6).



Omnichannel SKU Manifest: Comprehensive tabular view displaying Product Entity thumbnails, SKU codes, categories, retail price, gross margins, multi-hub inventory allocation (UK Global HQ, APAC Singapore, Rotterdam Port), and live status badges (Active/In Stock, Limited Drop, Low Stock Alert, Scheduled Drop).



Action Triggers: Global search bar, category filters, CSV catalog export, and modal trigger to + Create New Product.

Screen 7: Digital Asset Studio & CDN Vault (Admin | Media & Asset Library)





CDN Edge Telemetry: Edge cache hit ratio (99.88%), average response latency (14.2ms), compression yield (-74.6% WebP/AVIF savings), and origin sync status with manual cache purge button.



Curated Asset Matrix: Multi-ratio asset grid (1:1 PDP packshots, 3:2 and 4:5 editorial imagery) with batch recompression and upload capabilities.



Active Asset Inspector: Detailed side rail displaying dimensions, EXIF camera data (Hasselblad H6D-100c, 80mm f/2.8, ISO 64), storefront node bindings (Hero & PDP-770), and dual-language SEO alt-text localization.

Screen 8: The Club Journal CMS (Admin | The Club Journal (Blog CMS))





Story Workflow Queue: Tabbed pipeline across Published Essays, Scheduled Drops, Drafts & Pitches, and Author Roster.



Curatorial Article Builder: Edition selector, URL slug configuration, byline attribution, full-bleed 16:9 cover canvas selector, and rich editorial blocks (pull quotes, drop caps, shoppable lookbook widgets linked to SKU #APX-CR-882).



Reading & Social SEO Metrics: Live reading duration calculation, meta title/description inputs, and OpenGraph social card previews.

Screen 9: System Configuration (Admin | System Configuration)





Brand & Store Identity: Global store naming, brand motto, base currency (USD), default locale, and Wimbledon Heritage theme toggling with custom accent hex codes (#004225).



Release Rules & VIP Exclusivity: Automatic "New Arrival" badge duration (30 days), low stock warning thresholds (5 units), and VIP early-access gating for limited-edition racquets.



Order Fulfillment & White-Glove Services: Complimentary courier threshold ($200.00), 30-day prestige guarantee, and toggleable white-glove custom stringing & laser personalization.



Integrations & Real-Time Monitoring: Operational health checks for Stripe Luxury Merchant Gateway, ERP global inventory sync, and Klaviyo concierge messaging, backed by live server node telemetry and an audit log.



6. Bilingual & Localization Pipeline (EN / VI)





Primary Market (Global): Standard luxury English terminology and clean editorial typography.



Secondary Market (APAC / Vietnam): Full dual-language mirroring across all storefront assets and admin modules (Kickers, Headlines, CTA buttons, SEO descriptions, and Alt-text).



Validation Standard: All localized Vietnamese strings must render without character corruption or Unicode encoding artifacts.



7. Next Steps & Recommended Milestones





Responsive Viewports: Adapt the 4 core customer storefront screens into dedicated mobile app / mobile web layouts (390px width).



Checkout & Bag Drawer Flow: Design the micro-interactions for the cart slider, white-glove stringing customization modal, and one-click checkout.



Product Creation Wizard: Build the step-by-step modal for adding a new SKU within the Admin Catalog suite.
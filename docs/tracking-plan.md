# Horizon Backstage tracking plan

Last updated: 23 July 2026

The production preview does not send analytics data or install cookies. It emits decision-oriented events to `window.dataLayer`, ready for a consent-managed GA4 or GTM integration when an approved container ID is supplied.

| Event | Purpose | Properties | Trigger |
| --- | --- | --- | --- |
| `gallery_loaded` | Validate archive delivery | `media_count`, `day_1_count`, `day_2_count`, `day_3_count`, `page_path` | Gallery JSON loads |
| `gallery_filtered` | Learn which day and format visitors want | `filter_dimension`, `filter_name`, `page_path` | Day or media filter selected |
| `media_opened` | Measure viewing intent | `media_id`, `media_type`, `media_title`, `festival_day` | Lightbox opens |
| `media_shared` | Primary conversion | `media_id`, `media_type`, `share_platform`, `location` | Share completes or a desktop platform hand-off opens |
| `share_cancelled` | Share diagnostics | `media_id`, `media_type`, `share_platform`, `location` | Visitor dismisses the native share sheet |
| `share_failed` | Share diagnostics | `media_id`, `media_type`, `share_platform`, `location` | File preparation or platform hand-off fails |
| `share_menu_opened` | Measure sharing intent | `media_id`, `media_type`, `location` | Visible platform menu opens |
| `media_shared` | Measure organic sharing | `media_id`, `media_type`, `share_platform`, `location` | Platform, native share or copy action completes |
| `cta_clicked` | Measure navigation intent | `cta_name`, `cta_text` | Tracked CTA selected |

No event contains names, email addresses, IP addresses, device fingerprints or other deliberately collected personal data. Before connecting the data layer to GA4/GTM, add an approved consent mechanism, update the privacy notice and validate events in GA4 DebugView.

UTM naming convention for future campaigns: lowercase, hyphenated values such as `utm_source=instagram&utm_medium=organic-social&utm_campaign=backstage-2026&utm_content=gallery-launch`.

# Horizon Backstage tracking plan

Last updated: 23 July 2026

The production preview does not send analytics data or install cookies. It emits decision-oriented events to `window.dataLayer`, ready for a consent-managed GA4 or GTM integration when an approved container ID is supplied.

| Event | Purpose | Properties | Trigger |
| --- | --- | --- | --- |
| `gallery_loaded` | Validate archive delivery | `media_count`, `page_path` | Gallery JSON loads |
| `gallery_filtered` | Learn which media format visitors want | `filter_name`, `page_path` | Photo/video filter selected |
| `gallery_more_loaded` | Measure archive depth | `filter_name`, `visible_count` | More media displayed |
| `media_opened` | Measure viewing intent | `media_id`, `media_type`, `media_title` | Lightbox opens |
| `media_downloaded` | Primary conversion | `media_id`, `media_type`, `media_title`, `location` | Download selected |
| `media_shared` | Measure organic sharing | `media_id`, `share_method` | Native share or copy completes |
| `cta_clicked` | Measure navigation intent | `cta_name`, `cta_text` | Tracked CTA selected |

No event contains names, email addresses, IP addresses, device fingerprints or other deliberately collected personal data. Before connecting the data layer to GA4/GTM, add an approved consent mechanism, update the privacy notice and validate events in GA4 DebugView.

UTM naming convention for future campaigns: lowercase, hyphenated values such as `utm_source=instagram&utm_medium=organic-social&utm_campaign=backstage-2026&utm_content=gallery-launch`.


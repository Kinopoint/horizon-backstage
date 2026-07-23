# Horizon Backstage tracking plan

Last updated: 23 July 2026

The production preview does not send analytics data or install cookies. It emits decision-oriented events to `window.dataLayer`, ready for a consent-managed GA4 or GTM integration when an approved container ID is supplied.

Deployment status: the popularity API and interface are implemented and integration-tested, but the production endpoint is intentionally disabled until Cloudflare terms are approved. No share counts or browser tokens are collected in the current release.

| Event | Purpose | Properties | Trigger |
| --- | --- | --- | --- |
| `gallery_loaded` | Validate archive delivery | `media_count`, `day_1_count`, `day_2_count`, `day_3_count`, `page_path` | Gallery JSON loads |
| `gallery_filtered` | Learn which day and format visitors want | `filter_dimension`, `filter_name`, `page_path` | Day or media filter selected |
| `media_opened` | Measure viewing intent | `media_id`, `media_type`, `media_title`, `festival_day` | Lightbox opens |
| `media_shared` | Primary conversion | `media_id`, `media_type`, `share_platform`, `location` | Share completes or a desktop platform hand-off opens |
| `share_cancelled` | Share diagnostics | `media_id`, `media_type`, `share_platform`, `location` | Visitor dismisses the native share sheet |
| `share_failed` | Share diagnostics | `media_id`, `media_type`, `share_platform`, `location` | File preparation or platform hand-off fails |
| `share_menu_opened` | Measure sharing intent | `media_id`, `media_type`, `location` | Visible platform menu opens |
| `share_count_recorded` | Confirm a server-side popularity update | `media_id`, `media_type`, `share_platform`, `counted` | Popularity API accepts a completed share hand-off |
| `share_count_failed` | Monitor counter delivery | `media_id`, `media_type`, `share_platform` | Popularity API cannot record a completed hand-off |
| `share_counts_failed` | Monitor counter availability | `endpoint` | Initial popularity totals cannot be loaded |
| `gallery_sorted` | Measure interest in popularity ranking | `sort_name` | Visitor changes chronological/popular order |
| `cta_clicked` | Measure navigation intent | `cta_name`, `cta_text` | Tracked CTA selected |

The public number is a count of unique share hand-offs, not a confirmed Instagram, TikTok or Facebook publication. One completed hand-off per media item, browser and UTC day is eligible to increase the count.

No analytics event contains names, email addresses or raw network addresses. The popularity API receives a random first-party browser token and uses the request address only to create a rotating one-way daily hash. Raw addresses are not stored. Deduplication records are removed after eight days; aggregate media counts remain.

Before connecting the data layer to GA4/GTM, add an approved consent mechanism, update the privacy notice and validate events in GA4 DebugView.

UTM naming convention for future campaigns: lowercase, hyphenated values such as `utm_source=instagram&utm_medium=organic-social&utm_campaign=backstage-2026&utm_content=gallery-launch`.

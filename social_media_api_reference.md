# Social Media Hub — API Reference

## App Details
| Field | Value |
|-------|-------|
| App Name | social_media_hub |
| App ID | 939948138837764 |
| App Type | Business |
| App Mode | Development |

---

## Account IDs
| Field | Value |
|-------|-------|
| Facebook Page Name | Pk Fantasy League |
| Facebook Page ID | 106755558606727 |
| Instagram Account ID | 17841421765250162 |
| Instagram Username | @rohan_nvd |

---

## Access Tokens
| Token | Value |
|-------|-------|
| User Access Token | *(paste your token here)* |

> ⚠️ **Security Warning:** Never share your access token publicly. Tokens expire — regenerate from Graph API Explorer at https://developers.facebook.com/tools/explorer when needed.

---

## Base URL
```
https://graph.facebook.com/v25.0/
```

---

## Instagram APIs

### 1. Get Basic Profile Info
```
GET 17841421765250162?fields=followers_count,media_count,name,username,biography,website
```

### 2. Get All Posts with Engagement
```
GET 17841421765250162/media?fields=id,caption,like_count,comments_count,timestamp,media_type
```

### 3. Get Daily Engagement Insights (max 30 day range)
```
GET 17841421765250162/insights?metric=accounts_engaged,total_interactions,likes,comments,shares,saves&metric_type=total_value&period=day&since=YYYY-MM-DD&until=YYYY-MM-DD
```

### 4. Get Profile Views
```
GET 17841421765250162/insights?metric=profile_views&period=day&metric_type=total_value
```

### 5. Get Reach
```
GET 17841421765250162/insights?metric=reach&period=day
```

### 6. Get Single Post Insights
```
GET {POST_ID}/insights?metric=impressions,reach,likes,comments,shares,saved
```
Replace `{POST_ID}` with any post ID from your media list.

### 7. Get Instagram Account ID from Facebook Page
```
GET 106755558606727?fields=instagram_business_account
```

---

## Facebook APIs

### 1. Get Facebook Pages
```
GET me/accounts
```

### 2. Get Facebook Page Insights
```
GET 106755558606727/insights?metric=page_impressions,page_reach,page_engaged_users&period=day
```

### 3. Get Basic User Info
```
GET me?fields=id,name
```

### 4. Get User Info with Linked Accounts
```
GET me?fields=id,name,accounts{instagram_business_account}
```

---

## Post IDs Reference
| Caption | Post ID | Date | Likes |
|---------|---------|------|-------|
| ✨🌿 | 17883229722496317 | Mar 23, 2026 | 30 |
| عید مبارک 🌙 | 18166559509347451 | Jun 9, 2025 | 23 |
| Steps to elegance... | 17919503969931607 | Jan 9, 2025 | 24 |
| Serving tradition... | 18435954001073915 | Dec 16, 2024 | 22 |
| Masked up, hooded up... | 18498566929041248 | Nov 14, 2024 | 27 |
| Eid Mubarak 2K24 | 17854508385127481 | Apr 10, 2024 | 30 |
| Be More Of You... | 17949738152697602 | Oct 20, 2023 | 27 |
| Sunshine state of mind | 18095269192334943 | Oct 9, 2023 | 29 |
| EID '23 | 17986642171854464 | Apr 22, 2023 | 32 |
| Do not go where... | 17969071963949277 | Jan 7, 2023 | 31 |
| EID MUBARAK 2022 | 17951952586840274 | May 3, 2022 | 32 |
| PGC FAREWELL 2K21 | 18182136559081192 | Dec 17, 2021 | 23 |
| FROM ANOTHER POINT... | 17897924354450888 | Dec 9, 2021 | 22 |

---

## Graph API Explorer
Use this tool to test all queries:
https://developers.facebook.com/tools/explorer

## Notes
- Access tokens expire after a few hours — regenerate as needed
- For long-lived tokens (60 days), use the Access Token Debugger tool
- Maximum date range per insights query is **30 days**
- App is in **Development mode** — only works for your own accounts
- To access other users' data, App Review and going Live is required

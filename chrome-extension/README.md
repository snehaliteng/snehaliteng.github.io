# Job Tracker & Autofill - Chrome Extension

Track job applications and autofill forms using Supabase.

## Setup

### 1. Create Supabase Tables

Run `supabase-schema.sql` in your Supabase SQL Editor to create the required tables.

### 2. Generate Icons

Open `generate-icons.html` in a browser, right-click each canvas, and save as:
- `icons/icon16.png`
- `icons/icon48.png`  
- `icons/icon128.png`

### 3. Load Extension in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `chrome-extension/` folder

### 4. Configure

The extension uses your existing Supabase credentials (already configured in `background.js`).

## Features

- **Auto-tracking**: Visits to job sites (LinkedIn, Indeed, Greenhouse, Lever, Workday, etc.) are automatically tracked
- **Status management**: Mark applications as Applied, Interview, Offered, Rejected
- **Form autofill**: Stores your profile and fills job application forms with one click
- **Field detection**: Intelligently matches form fields (name, email, phone, LinkedIn, resume URL, etc.)
- **History**: View all tracked applications in the popup

## File Structure

```
chrome-extension/
  manifest.json       # Manifest V3 configuration
  background.js       # Service worker (Supabase sync)
  content.js          # Content script (form detection & autofill)
  popup.html          # Extension popup UI
  popup.js            # Popup logic
  supabase-schema.sql # Database schema
  generate-icons.html # Icon generator tool
  icons/              # Extension icons (create via generator)
```

## Admin Dashboard

View all tracked applications at: `admin/JobApplication/index.html`

Requires admin authentication (snehaliteng@gmail.com).

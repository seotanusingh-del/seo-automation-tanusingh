# SEO AUTOMATOR — Enterprise Multi-Airline Document & SEO Automation Platform

**SEO AUTOMATOR** is a full-stack enterprise web application built for **Workspace Suite · TANU SINGH**. It provides multi-airline SEO document generation (`.pdf` and `.docx`), direct 3rd-party app sharing with auto-download, concatenated parasite/campaign URL building with live Google Sheets synchronization, global Page-1 SERP rank checking without a VPN, and a 6-engine bulk Whitehat/Greyhat/Blackhat SEO automation suite.

---

## 1. User Profile, Developer Info & PWA Install Popup

### Navigation Profile Header
- Displays the custom **User Avatar Icon** at the top of the side navigation panel along with:
  - **Application Title**: `SEO AUTOMATOR`
  - **Subtitle**: `Workspace Suite · TANU SINGH`
- Profile display name and avatar photo can be customized anytime under **Settings &rarr; Application Default Values & Profile Settings**.

### Login Screen & Developer Info
- **Bottom Floating Install App Popup**: Displays a floating bottom popup card on the login screen (*"Install SEO AUTOMATOR for faster access."*) with an **Install App** button and dismiss (`X`) button, backed by a full Progressive Web App (PWA) manifest and service worker.
- **Developer Contact Links**:
  - **LinkedIn**: [https://www.linkedin.com/in/shashankrajputx/](https://www.linkedin.com/in/shashankrajputx/)
  - **Gmail**: [aws.shashanksingh@gmail.com](mailto:aws.shashanksingh@gmail.com)
  - **Instagram**: [https://www.instagram.com/shashankrajput.__/](https://www.instagram.com/shashankrajput.__/)

---

## 2. End-to-End Security, 2FA OTP & Session Protection

### Mandatory Sign-In + Two-Step Invisible OTP Verification (2FA)
Every login requires two verification steps:
1. **Step 1 — Credentials**:
   - **Username**: `8081368879`
   - **Default Password**: `seo.8268`
2. **Step 2 — Mandatory 2FA Login OTP Popup**:
   - **Login Security OTP**: `6307500844`
   - Masked (`type="password"`) so no onlooker can see the typed OTP.

### Compromised Password Recovery (Owner OTP Protected)
Under **Settings &rarr; Security & Password Reset**, the original owner can reset a compromised password or restore the default password by verifying the masked **Owner Verification OTP**:
- **Owner Verification OTP**: `6391059119`

### Backend Security Hardening (`api/index.ts`)
- **Constant-Time Cryptographic Comparisons**: Uses `crypto.timingSafeEqual` with SHA-256 digests for username, password, Login OTP, and Owner Recovery OTP verification to prevent timing side-channel attacks.
- **Brute-Force Rate Limiting & Temporary IP Lockout**: Automatically locks out repeated failed authentication or OTP attempts for 15 minutes (`HTTP 429`).
- **Cryptographic Session Tokens & Security Headers**: Issues 256-bit random session tokens and sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Cache-Control: no-store` on auth endpoints.
- **Immediate Session Lock on Tab Close / Refresh**: Closing or refreshing the browser tab immediately locks the session while keeping workspace inputs auto-saved.

---

## 3. Core Application Modules

### Module 1: Airlines Pdf Generator — Multi-Airline PDF & DOCX Studio
- **Default Old TFN Fallback & Reset Default Values**:
  - Leaving **Old TFN Number** empty automatically uses the configured Default Old TFN (`+1-800-555-0199` or your custom default from Settings).
  - Click **Reset Default Values** anytime to restore Old TFN, New TFN, and Replacement Word to your configured defaults without retaining stale TFN numbers.
- **Direct Share to 3rd-Party Apps (Auto-Download + Share)**:
  - Click **Share Output ZIP**, **Share All as ZIP**, or the **Share** button next to any individual airline PDF.
  - Automatically downloads the `.pdf` or `.zip` file to your device and triggers the native OS/browser share sheet or opens the **Share to 3rd-Party Apps** modal (WhatsApp, Telegram, Gmail Compose, Copy Summary) so you can share immediately without extra steps.
- **Pure-Web Vector PDF Engine (`src/lib/pdfEngine.ts`)**:
  - Preserves headings (`H1`–`H4`), bold/italic/underline runs, custom colors, lists, tables, clickable `tel:` / `https://` links, and headers/footers across all 26+ airlines.

### Module 2: Link Conc Generator — Bulk URL Concatenator & Google Sheet Sync
- **Priority Top Workspace**: Combine Common Prefix + Variable Suffix, bulk-paste suffixes, or 1-click auto-build all 26 airline links.
- **Bottom Shared Setup**: Live Google Sheet URL/ID editor, worksheet tab selector, column (`A`–`Z`), and start row mapping with live cell badges (`SEO!B3`).

### Module 3: Airline Content — 6-Slot HTML & Plain-Text Content Generator
- Generates customized multi-airline SEO articles with H1, H2, TFN, and 6 sub-content sections with 1-click **Copy HTML** and **Copy Text**.

### Module 4: Rank Checker — No-VPN Global Country Server + Page-1 TFN Highlighter
- Browse any country/city Google Server (`uule` canonical geolocation encoding + `gl`, `hl`, `cr`, `pws=0`) without a VPN and highlight your Targeted TFN on Page 1.

### Module 5: SEO Bulk Automation — 6-Engine Whitehat & Blackhat Suite
- Includes Bulk IndexNow & Archive Ping Blaster + Live Googlebot URL Auditor, Multi-Airline Spintax & Mass Page Builder, 16-Format Anti-Filter TFN Obfuscation Matrix, Tier-1/Tier-2 Backlink Anchor Matrix & Schema Pack, Gov/Edu Parasite Search URL Weaver, and Bulk Keyword Permutator & 301 Redirect Generator.

### Module 6: Settings — Default Value Overwrite & JSON Key Auto-Fetcher
- **Overwrite Mode (No Old Values Retained)**:
  - Updating **Default Old TFN / New TFN / Replacement Word**, **Default Google Docs Link**, or **Google Cloud Service Account Credentials** immediately purges previous cached values from `localStorage` and overwrites them cleanly.
- **Direct JSON Key File Upload & Auto-Fetch**:
  - Drag & drop or upload any Google Cloud Service Account `.json` key file to automatically extract, populate, and save `project_id`, `client_email`, and `private_key` without manual typing.

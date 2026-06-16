# BigQuery Release Notes Explorer 🚀

A premium, interactive web application built with Python Flask and plain vanilla HTML, CSS, and JavaScript. This tool fetches the official Google Cloud BigQuery release notes RSS feed, parses and splits multi-update entries into individual categorized alerts, and allows users to search, filter, and draft customized updates to post directly on X (formerly Twitter).

---

## ✨ Features

- **Granular Feed Parsing**: Automatically parses the Atom XML feed and splits daily logs containing multiple updates (delimited by `<h3>` tags) into distinct cards.
- **Modern Glassmorphic UI**: Designed with a high-end dark theme featuring subtle gradient backgrounds, glowing elements, smooth hover states, and card-loading skeleton shimmers.
- **Dynamic Stats Summary**: Calculates and displays total features, issues, and deprecations at a glance. Clicking any stat card filters the list automatically.
- **Fuzzy Search & Filters**: Live, client-side keyword filtering combined with category selection and sorting (newest/oldest).
- **Clipboard Utility**: One-click actions to copy direct release anchor links or copy formatted plain text representations.
- **Smart Twitter/X Draft Modal**: Preloads structured tweet drafts (including emoji, tags, dates, and URL details), monitors character budgets against the 280-character limit in real time, and handles redirects to X's intent composer.

---

## 🛠️ Technology Stack

- **Backend (Server)**:
  - Python 3.x
  - Flask (Web Server & Routing)
  - Beautiful Soup 4 (HTML Parsing & Slicing)
  - Requests (External API Integration)
  - ElementTree (XML Parse Utility)
- **Frontend (Client)**:
  - Plain Vanilla HTML5 (Semantic Structure)
  - Vanilla CSS3 (Custom Variables, Backdrop Blur Filters, Responsive Grid/Flexbox Layouts)
  - Plain JavaScript (ES6+ State Management, DOM Events, API Integration)

---

## 📂 Project Structure

```text
├── .gitignore               # Excludes python cache, venvs, and editor metadata
├── app.py                   # Flask server, feed scraper & parsing engine
├── README.md                # Project documentation
├── templates/
│   └── index.html           # HTML5 UI layout structure
└── static/
    ├── css/
    │   └── style.css        # Core design system stylesheet
    └── js/
        └── main.js          # Client-side routing, filtering & modal logic
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have Python 3 installed on your local machine.

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/harsh-parit/event-talks-app.git
   cd event-talks-app
   ```

2. **Create and Activate a Virtual Environment**
   - **Windows (CMD/PowerShell)**:
     ```powershell
     python -m venv .venv
     .venv\Scripts\activate
     ```
   - **macOS/Linux**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install Dependencies**
   ```bash
   pip install flask requests beautifulsoup4
   ```

---

## 🏃 Running the Application

1. **Start the Flask Server**
   ```bash
   python app.py
   ```
2. **Access the App**
   Open your preferred browser and navigate to:
   ```text
   http://127.0.0.1:5000
   ```

---

## 📡 API Endpoints

### `GET /`
Serves the responsive single-page web app frontend.

### `GET /api/release-notes`
Fetches Google Cloud's official BigQuery Atom feed, splits the XML/HTML body elements, and returns a structured JSON list:
```json
{
  "title": "BigQuery - Release notes",
  "last_updated": "2026-06-15T00:00:00-07:00",
  "updates": [
    {
      "id": "up-1",
      "date": "June 15, 2026",
      "raw_date": "2026-06-15T00:00:00-07:00",
      "type": "Feature",
      "html": "<h3>Feature</h3><p>Use Gemini Cloud Assist to...</p>",
      "text": "Use Gemini Cloud Assist to analyze your SQL queries...",
      "link": "https://cloud.google.com/bigquery/docs/release-notes#June_15_2026"
    }
  ]
}
```

---

## 🤝 Contributing
Feel free to open issues or submit pull requests to enhance the filters, improve the parser, or customize the UI layout templates.

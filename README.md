# Construction Intelligence Platform (static website)

Plain HTML/CSS/JS. No build step, no server, no database.

```
construction-website/
├── index.html   # page structure
├── style.css    # styling
├── script.js    # all logic (Gemini calls, valuation, weather, chat)
└── README.md
```

## Run
Open `index.html` in a browser, or serve it: `python -m http.server 8000`.
Paste a Gemini API key in the header for live AI; leave empty for demo mode.

## Deploy (free)
Drag the folder onto Netlify Drop, or push to GitHub and enable GitHub Pages.

Note: the key is entered by each visitor and used from their browser only.

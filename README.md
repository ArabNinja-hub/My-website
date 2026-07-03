# StudyCore Website

## Setup Instructions

### Prerequisites
- [VS Code](https://code.visualstudio.com/) installed
- **Live Server** extension installed in VS Code
  - Open VS Code → Extensions (Ctrl+Shift+X) → Search "Live Server" by Ritwick Dey → Install

---

### How to Run

1. Open the `studycore` folder in VS Code:
   - File → Open Folder → select the `studycore` folder

2. Right-click on `index.html` in the Explorer panel

3. Click **"Open with Live Server"**

4. Your browser will open at `http://127.0.0.1:5500`

---

### Folder Structure

```
studycore/
├── index.html          ← Main website page
├── css/
│   └── style.css       ← All styles
├── js/
│   └── main.js         ← All JavaScript + AI chat
└── assets/
    └── logo.jpg        ← StudyCore logo
```

---

### AI Tutor Feature

The AI chat widget uses the **Anthropic Claude API**.

To make it fully live:
1. Get your API key from https://console.anthropic.com
2. You'll need a simple backend proxy (Node.js/Python) to securely pass your API key — never put API keys directly in HTML files for production.

For local testing, the chat widget is fully styled and demonstrates the UI.

---

### Customisation Tips

- **Colors**: Edit the `:root` variables at the top of `css/style.css`
- **Documents**: Add more `.doc-card` blocks in `index.html`
- **Subjects**: Add subject cards in the subjects grid
- **Logo**: Replace `assets/logo.jpg` with your image

---

Built with ❤️ for StudyCore students across Africa.

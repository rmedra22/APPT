# AGENT.md - GFI Data Entry System

## Architecture
- **Frontend**: HTML/CSS/JavaScript app with Google Apps Script backend
- **Main Files**: `index.html` (UI), `script_enhanced.js` (frontend logic), `Code.gs` (Google Apps Script backend)
- **Database**: Google Sheets with multiple tabs (Personal Details, System Progressions, etc.)
- **Authentication**: User/admin roles via Agents sheet

## Development Commands
- **Start dev server**: Run `start_server.bat` (offers Python/Node.js options)
- **Test locally**: `python -m http.server 8000` or `npx http-server`
- **No build/test/lint commands** - direct file editing

## Code Style & Conventions
- **JavaScript**: CamelCase for variables, functions. Use `const`/`let`, template literals
- **Forms**: Each form maps to Google Sheet (see `formSheetMap` in script_enhanced.js)
- **API**: JSONP calls to Google Apps Script, async/await patterns
- **Error handling**: `toastManager.show()` for user feedback, console.log for debug
- **Naming**: Form IDs end with 'Form', sheet names are descriptive (e.g., 'Personal Details')
- **Authentication**: Check `currentAgent.role` for admin features, trim user inputs
- **Auto-save**: 2-second debounced saves, can be toggled by users

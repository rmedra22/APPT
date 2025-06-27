# GitHub Hosting Setup for CSS and JavaScript Files

Your HTML file has been updated to load CSS and JavaScript files from GitHub instead of local files. Here are your options:

## Option 1: GitHub Pages (Recommended)

### Setup Steps:
1. Go to your repository: https://github.com/rmedra22/APPT
2. Click on **Settings** tab
3. Scroll down to **Pages** section in the left sidebar
4. Under **Source**, select **Deploy from a branch**
5. Choose **main** branch and **/ (root)** folder
6. Click **Save**

### Your files will be available at:
- CSS: `https://rmedra22.github.io/APPT/styles_enhanced.css`
- JS: `https://rmedra22.github.io/APPT/script_enhanced.js`

### Benefits:
- Free hosting from GitHub
- Automatic updates when you push changes
- Fast loading times
- Custom domain support (optional)

## Option 2: jsDelivr CDN (Alternative)

If you prefer to use a CDN service, you can switch to jsDelivr by:

1. Comment out the GitHub Pages links in your HTML
2. Uncomment the jsDelivr CDN links

### jsDelivr URLs:
- CSS: `https://cdn.jsdelivr.net/gh/rmedra22/APPT@main/styles_enhanced.css`
- JS: `https://cdn.jsdelivr.net/gh/rmedra22/APPT@main/script_enhanced.js`

### Benefits:
- Works immediately (no setup required)
- Global CDN with fast loading
- Automatic caching
- Version control with @main, @latest, or specific commit hashes

## Current Configuration

Your `index.html` file is currently configured to use **GitHub Pages** (Option 1). The jsDelivr links are commented out as alternatives.

## Testing

After setting up GitHub Pages:
1. Wait 5-10 minutes for GitHub Pages to deploy
2. Test your website to ensure CSS and JS files load correctly
3. Check browser developer tools (F12) for any loading errors

## Updating Files

When you make changes to `styles_enhanced.css` or `script_enhanced.js`:
1. Commit and push changes to your GitHub repository
2. GitHub Pages will automatically update (may take a few minutes)
3. Clear browser cache if needed to see changes

## Troubleshooting

If files don't load:
1. Check if GitHub Pages is properly enabled
2. Verify the repository is public
3. Wait a few minutes for deployment
4. Check browser console for error messages
5. Try the jsDelivr CDN option as a fallback

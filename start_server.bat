@echo off
echo Starting WFG Development Server...
echo.
echo Choose your server method:
echo 1. Python (if you have Python installed)
echo 2. Node.js (if you have Node.js installed)
echo 3. Manual instructions
echo.
set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo Starting Python server on port 8000...
    echo Open http://localhost:8000 in your browser
    python -m http.server 8000
) else if "%choice%"=="2" (
    echo Installing http-server...
    npm install -g http-server
    echo Starting Node.js server...
    echo Open http://localhost:8080 in your browser
    http-server
) else (
    echo.
    echo Manual Instructions:
    echo 1. Install Python or Node.js
    echo 2. For Python: python -m http.server 8000
    echo 3. For Node.js: npm install -g http-server then http-server
    echo 4. Open the localhost URL in your browser
    echo.
    pause
)
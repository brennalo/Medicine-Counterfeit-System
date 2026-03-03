@echo off
echo ==========================================
echo Medicine Counterfeit Prevention System
echo Starting Frontend
echo ==========================================
echo.

cd /d "%~dp0frontend"
echo Current directory: %CD%
echo.

REM Check if .env.local exists
if not exist ".env.local" (
    echo ERROR: .env.local not found!
    echo.
    echo Please create .env.local from .env.example:
    echo   1. Copy .env.example to .env.local
    echo   2. Add your contract addresses from deployment
    echo.
    echo Example:
    echo   NEXT_PUBLIC_USER_AUTH_ADDRESS=0x5FbDB...
    echo   NEXT_PUBLIC_MEDICINE_TRACKING_ADDRESS=0xe7f17...
    echo.
    pause
    exit /b 1
)

echo Starting Next.js development server...
echo.
echo The application will be available at:
echo   http://localhost:3000
echo.
echo Login with: HOSPITAL001 / hospital123
echo.

npm run dev

pause

@echo off
echo ==========================================
echo Medicine Counterfeit Prevention System
echo Dependency Installation Script
echo ==========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js is installed.
echo.

REM Install Backend Dependencies
echo ===== Installing Backend Dependencies =====
cd backend

if exist node_modules (
    echo Removing old node_modules...
    rmdir /s /q node_modules
)

if exist package-lock.json (
    echo Removing old package-lock.json...
    del package-lock.json
)

echo Installing backend packages...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install backend dependencies
    cd ..
    pause
    exit /b 1
)

echo Backend dependencies installed successfully!
echo.

REM Install Frontend Dependencies
cd ..\frontend

echo ===== Installing Frontend Dependencies =====

if exist node_modules (
    echo Removing old node_modules...
    rmdir /s /q node_modules
)

if exist package-lock.json (
    echo Removing old package-lock.json...
    del package-lock.json
)

echo Installing frontend packages...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install frontend dependencies
    cd ..
    pause
    exit /b 1
)

echo Frontend dependencies installed successfully!
echo.

cd ..

echo ==========================================
echo Setup completed successfully!
echo ==========================================
echo.
echo Next steps:
echo.
echo 1. Start blockchain (Terminal 1):
echo    cd backend
echo    npx hardhat node
echo.
echo 2. Deploy contracts (Terminal 2):
echo    cd backend
echo    npx hardhat run scripts/deploy.ts --network localhost
echo.
echo 3. Configure frontend:
echo    cd frontend
echo    copy .env.example .env.local
echo    Then edit .env.local with contract addresses
echo.
echo 4. Start frontend (Terminal 3):
echo    cd frontend
echo    npm run dev
echo.
echo For more information, see QUICKSTART.md
echo.
pause

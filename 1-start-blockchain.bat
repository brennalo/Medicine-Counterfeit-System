@echo off
echo ==========================================
echo Medicine Counterfeit Prevention System
echo Starting Blockchain Node
echo ==========================================
echo.

cd /d "%~dp0backend"
echo Current directory: %CD%
echo.
echo Starting Hardhat node...
echo Press Ctrl+C to stop
echo.

npx hardhat node

pause

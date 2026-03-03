@echo off
echo ==========================================
echo Medicine Counterfeit Prevention System
echo Deploying Smart Contracts
echo ==========================================
echo.

cd /d "%~dp0backend"
echo Current directory: %CD%
echo.
echo Deploying contracts to localhost network...
echo.

npx hardhat run scripts/deploy.ts --network localhost

echo.
echo ==========================================
if %ERRORLEVEL% EQU 0 (
    echo Deployment successful!
    echo.
    echo IMPORTANT: Copy the contract addresses above
    echo You need them for the frontend configuration
) else (
    echo Deployment failed!
    echo Make sure the blockchain node is running first
    echo Run 1-start-blockchain.bat in another window
)
echo ==========================================
echo.
pause

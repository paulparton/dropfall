@echo off
title Dropfall Game Server
echo ==========================================
echo          Starting Dropfall Game
echo ==========================================

:: Navigate to the game directory
cd game

:: Install dependencies if they are missing
echo Checking and installing dependencies...
call npm install

:: Start the Vite development server and automatically open the default browser
echo Starting development server and launching webpage...
call npm run dev -- --open

pause

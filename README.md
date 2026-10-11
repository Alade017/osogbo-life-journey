# Osogbo Life: Origins

Build Phase 1 of a production-quality browser game called OSOGBO LIFE.

OSOGBO LIFE is an original Nigerian browser-based life simulation game set in a fictionalized, game-inspired version of Osogbo, Nigeria.

The core concept is:

Create your character → enter Osogbo → get a job → earn virtual money → complete missions → improve your life → save your progress.

Do NOT attempt to build the entire game yet. Build only the foundation and MVP.

TECHNICAL DIRECTION

Use:

React + TypeScript

Modern responsive UI

Tailwind CSS

Supabase for authentication and PostgreSQL

Clean reusable components

GitHub-compatible source structure

Do not lock important game logic into the frontend.

All player money, progression, character data and other important game state must eventually be validated server-side.

VISUAL STYLE

Create a distinctive miniature Nigerian city aesthetic.

The visual direction should feel like:

miniature diorama

construction-toy-inspired

colorful

playful

polished

modern

Nigerian

game-like

Do NOT use LEGO branding, LEGO assets, copyrighted characters or proprietary game assets.

Use original shapes, illustrations and UI components.

The city should feel inspired by Osogbo without claiming to be an exact geographic simulation.

PHASE 1 SCREENS

Build these screens:

Landing Page

Sign Up

Login

Character Creation

City Dashboard

City Map

Jobs

Wallet

Inventory

Missions

Player Profile

Notifications

Settings

CHARACTER CREATION

Allow the player to create:

character name

gender/presentation

avatar appearance

age

personality

starting occupation preference

Store the character in Supabase.

PLAYER PROFILE

Create initial player statistics:

Level

XP

Money

Energy

Health

Happiness

Reputation

Intelligence

Social

Career

Wealth

Use sensible starting values.

Do not allow the client to arbitrarily modify important statistics.

CITY

Create an interactive Osogbo-inspired city dashboard.

Initial fictional districts/locations:

City Centre

Oja Oba

Oke-Fia

Old Garage

Student District

Residential District

Business District

Cultural District

Rural Outskirts

Each location should have a card and basic description.

For now, locations can lead to placeholder/coming-soon sections where functionality has not yet been implemented.

Do NOT create fake functionality that appears completed.

JOB SYSTEM

Create an initial job system.

Example jobs:

Shop Assistant

Delivery Rider

Graphic Designer

Web Developer

Teacher

Mechanic

Photographer

Food Vendor

Each job should contain:

name

description

salary/reward

energy cost

required level

cooldown

The player should be able to select an available job and perform a job action.

Rewards must be validated through backend/server logic rather than simply modifying the wallet from the browser.

WALLET

Create a wallet showing:

current balance

recent transactions

income

expenses

Use virtual Nigerian Naira values.

Clearly label the money as in-game currency.

Never imply that players can withdraw the virtual money as real Nigerian currency.

MISSIONS

Create an initial mission system.

Example missions:

Get your first job

Earn your first ₦10,000

Visit 3 locations

Complete 3 jobs

Reach Level 2

Show:

mission title

description

progress

reward

completion status

INVENTORY

Create an inventory interface for future items.

Initially include a few simple starter items such as:

Phone

Backpack

Basic Outfit

Water Bottle

The inventory must be stored in the database.

DATABASE

Create the necessary Supabase database structure.

Start with tables such as:

profiles

characters

jobs

character_jobs

wallets

transactions

inventory_items

player_inventory

missions

player_missions

locations

notifications

Use proper relationships.

Add timestamps.

Use UUIDs where appropriate.

SECURITY

Use Supabase Row Level Security.

A player must only be able to access their own private character, wallet, inventory and progression data.

Never trust client-side wallet updates.

Never expose service-role credentials in the frontend.

Validate important game actions server-side.

RESPONSIVE DESIGN

The game must work well on:

Android phones

tablets

laptops

desktop browsers

Prioritize mobile because many Nigerian players will access the game from mobile devices.

NAVIGATION

Create a clear game navigation system:

Home
Map
Jobs
Wallet
Inventory
Missions
Profile

On mobile, use a bottom navigation bar where appropriate.

IMPORTANT DEVELOPMENT RULE

Do NOT build:

multiplayer

3D world

vehicles

businesses

elections

advanced NPC AI

marketplace

social media

advanced relationships

real-time chat

cryptocurrency

real-money gambling

real-money withdrawals

yet.

Those belong to later development phases.

QUALITY REQUIREMENTS

Do not create:

fake buttons

fake balances

fake database functionality

hardcoded player progression

fake authentication

placeholder features presented as finished

Every Phase 1 feature should either work or clearly say "Coming Soon."

Create a clean architecture that can be extended later.

At the end, provide:

Files created

Supabase tables created

Database relationships

Authentication configuration

RLS policies

Server-side functions

Environment variables required

How to run the project

What remains for Phase 2

Build Phase 1 only.

## Local development in VS Code

This repository builds independently with React, TanStack Start, Vite, Tailwind, and a Node server. Supabase provides authentication and the authoritative game database.

Use Node.js 22.12 or newer. Open this folder in VS Code, configure .env using .env.example, and run:

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:3000. To test a production build locally:

```powershell
npm.cmd run build
npm.cmd run preview
```

The production preview uses the Node server in .output/server/index.mjs. Stop the development server before starting preview if both use port 3000. Run npm.cmd run typecheck, npm.cmd run lint, and npm.cmd test for checks.

Configure both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. For server features, configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY as well. Enable Google or guest authentication in your own Supabase project if using those login methods. Add http://127.0.0.1:3000/login and http://localhost:3000/login to Supabase Auth's redirect allowlist; also allow the character-creation and password-recovery redirects used by the interface.

DATABASE_URL is a server-only PostgreSQL migration connection, separate from the public Supabase API URL/key. Apply the pending HUD migration with npm.cmd run db:migrate:hud once it is configured. See docs/shared-hud-simulation.md. Keep credentials out of version control.

The playable city now uses Phaser 3 with React menus and the existing 3D home. Run `npm.cmd run dev:public` for the separate public website, or `npm.cmd run build:public` to build it into `dist-public`. Configure `VITE_GAME_URL` to point that site at your game deployment. See [neighborhood architecture and acceptance criteria](docs/neighborhood-architecture.md) for state ownership, art rules and the separate Vercel build setup.

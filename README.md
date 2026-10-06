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

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://osogbo-life-journey.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/71d03941-f17e-5bc2-bb21-66ffd5f50730).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

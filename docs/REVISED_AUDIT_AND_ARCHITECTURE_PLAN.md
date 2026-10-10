# OSOGBO LIFE
## Revised Repository Audit and Technical Architecture Plan

**Document status:** Proposed architecture and implementation specification  
**Product:** OSOGBO LIFE — Online Multiplayer Life Simulation  
**Primary reference experiences:** https://lagoslife.app/ and https://lagoslove.app/city  
**Frontend:** React + TypeScript  
**Game engine:** Phaser 3  
**Backend:** Supabase  
**Frontend deployment:** Vercel  
**Target platforms:** Desktop and mobile browsers

---

# 1. PRODUCT VISION

OSOGBO LIFE is an online multiplayer life-simulation game set in an original fictional city inspired by Osogbo, Nigeria.

Players create characters, explore neighborhoods, encounter other real players, communicate, make friends, travel between districts, enter buildings, visit homes, complete jobs, earn currency, purchase items, and progress through a persistent game world.

The product must combine three connected experiences:

1. A polished public website that introduces the game and encourages players to join.
2. A secure authentication and character-onboarding experience.
3. A functional, interactive multiplayer game with real player interactions and persistent progression.

LagosLife and LagosLove are reference experiences for interaction quality, city-life presentation, and product structure. OSOGBO LIFE must establish its own visual identity, original art, world design, and gameplay.

## Product principles

- Build real functionality, not decorative mockups.
- Prioritize a living, explorable world over static dashboards.
- Make every advertised action functional.
- Support multiplayer from the foundational architecture.
- Make the world expandable without requiring a complete rewrite.
- Preserve working existing code and assets where appropriate.
- Design for desktop and mobile browsers from the beginning.
- Validate sensitive gameplay operations on trusted server-side infrastructure.
- Keep the public website and game application separately deployable but logically connected.
- Test real user journeys rather than relying on visual appearance alone.

---

# 2. NON-NEGOTIABLE PROJECT RULES

Codex must inspect the existing repository before making implementation decisions.

It must not assume that existing features, database objects, assets, routes, or deployment settings exist without evidence.

Before implementation, inspect:
- Repository structure and Git status.
- Package manifests and lockfiles.
- Existing instructions and architecture documentation.
- Routes, pages, components, and design system.
- Phaser initialization, scenes, input, collision, and rendering.
- Existing game systems and assets.
- Supabase clients, schema, migrations, RLS, and server functions.
- Multiplayer or networking integrations, if any.
- Vercel configuration and domain separation.
- Tests, build scripts, and known defects.

Preserve uncommitted user changes. Do not replace the entire application with a new scaffold merely because the current result is unsatisfactory.

Do not expose secrets or credentials.

Do not perform destructive database changes, change production authentication settings, change DNS, or deploy to production without the necessary explicit authorization.

Separate verified findings from assumptions and recommendations.

---

# 3. REPOSITORY AUDIT SPECIFICATION

## 3.1 Repository and framework audit

Record:
- Repository and accessible workspace.
- Current branch and commit.
- Uncommitted changes.
- Package manager and framework versions.
- Application entry points.
- Website and game routes.
- Build and test scripts.
- Existing shared libraries and services.
- Existing documentation and architecture decisions.

Determine whether the current repository contains one application or multiple applications.

Do not assume that the public website and game are already separate projects.

## 3.2 Homepage audit

Inspect the actual homepage and document:
- Current layout and visual hierarchy.
- Header and navigation.
- Hero section and game-world presentation.
- Play Now and account-entry actions.
- Feature sections and calls to action.
- Existing game previews and artwork.
- Responsive behavior.
- Loading and error states.
- Accessibility and performance.
- Broken, decorative, or nonfunctional controls.

Explain specifically why the current result does or does not communicate the intended life-simulation experience.

Recommend changes based on evidence from the actual implementation.

## 3.3 Authentication audit

Inspect:
- Registration and login.
- Password recovery.
- Supabase Auth integration.
- Session restoration and expiry.
- Protected routes.
- Character creation.
- New-player onboarding.
- Returning-player flow.
- Logout.
- Website-to-game redirects.
- Allowed authentication redirect URLs and origins, where accessible.

Determine how sessions will work across the separate website and game domains.

Do not assume that browser storage is shared between separate domains. Recommend a supported, secure authentication flow and identify the configuration required.

## 3.4 Phaser and gameplay audit

Inspect:
- Phaser initialization and destruction.
- Scene management.
- React–Phaser communication.
- Input handling.
- Player movement and animation.
- Collision and navigation.
- Camera and viewport scaling.
- Asset loading.
- NPC behavior.
- Buildings and entrances.
- Interior scenes.
- Location transitions.
- Gameplay progression.
- Persistence integration.
- Desktop and mobile controls.

Identify duplicate state ownership, unnecessary coupling, scene lifecycle defects, missing systems, and rendering bottlenecks.

## 3.5 Multiplayer audit

Determine whether actual networking exists or whether the current implementation is single-player only.

Inspect:
- Multiplayer client or SDK.
- Server runtime and hosting.
- Player identity and session validation.
- World or room membership.
- Player state synchronization.
- Presence and disconnection cleanup.
- Reconnection.
- State interpolation and prediction.
- Server authority.
- Message validation and rate limits.
- Area capacity and world partitioning.
- Networking tests.

If no multiplayer system exists, report that as a missing capability rather than pretending that local NPCs or simulated players constitute multiplayer.

## 3.6 Social-system audit

Inspect existing support for:
- Nearby-player interactions.
- Player profiles.
- Text chat.
- Private messages.
- Friend requests and friend lists.
- Presence and online status.
- Blocking and muting.
- Reporting and moderation.
- Home visits and access permissions.
- Shared activities.

For each feature, record whether it is:
- Implemented and verified.
- Partially implemented.
- Present only as UI.
- Missing.
- Blocked by infrastructure or security concerns.

## 3.7 World and travel audit

Inspect:
- Existing map data and assets.
- World coordinates.
- District or area identifiers.
- Streets, paths, and collision objects.
- Buildings and entrances.
- Interior scenes.
- Spawn and return points.
- Destination discovery.
- Location persistence.
- Area transitions.
- Multiplayer room transitions.
- Asset loading and unloading.

Determine whether the game can support multiple connected locations without loading the entire world at once.

## 3.8 Economy and persistence audit

Inspect:
- Player profiles.
- Character data.
- Currency.
- Jobs and task progress.
- Inventory.
- Purchases.
- Homes and furniture.
- Rewards and transaction records.
- Save and restore.
- Server-side validation.
- RLS policies.
- Database constraints and transaction handling.

Identify whether sensitive operations trust client-supplied values.

Do not claim a security vulnerability without evidence. Distinguish verified defects from potential risks.

## 3.9 Deployment audit

Inspect:
- Website and game deployment arrangements.
- Vercel projects and configuration.
- Domain and routing configuration.
- Build commands and output directories.
- Environment-variable names without exposing values.
- Supabase origins and redirect configuration.
- Multiplayer server hosting and connectivity.
- Development, preview, and production separation.

Identify deployment dependencies that must be resolved before implementation or release.

---

# 4. TARGET PRODUCT EXPERIENCE

## 4.1 Public website

The homepage should establish the identity of OSOGBO LIFE immediately.

Required elements:
- Original brand identity.
- Strong hero section featuring the game world.
- Prominent Play Now and account-entry actions.
- City and character previews.
- Exploration, jobs, social features, homes, and progression highlights.
- Clear instructions for new players.
- Responsive navigation.
- Functional calls to action.
- Appropriate loading, focus, hover, and error states.
- Accessibility and performance considerations.

Use authentic game assets where available. Do not advertise unavailable features as if they already exist.

Avoid a generic SaaS template, excessive empty space, and static decorative sections that do not help users understand the game.

## 4.2 Authentication and onboarding

Required user journey:

1. Open the public website.
2. Select Play Now or an account action.
3. Register or log in.
4. Recover an account if necessary.
5. Create or select a character.
6. Complete initial onboarding.
7. Enter the multiplayer world.
8. Resume saved progression on later visits.

The game must handle expired sessions, loading, authentication errors, and reconnection.

Authentication across separate domains must use a supported flow, correctly configured redirect URLs, and server-validated identity.

## 4.3 Game application

The game interface must prioritize the actual world.

Required systems:
- Playable city viewport.
- Player movement.
- Camera and collisions.
- Character animation.
- Nearby-player discovery.
- NPC interactions.
- Location and building interactions.
- Chat and social interfaces.
- Inventory and currency.
- Jobs and progression.
- Location directory or city map.
- Travel and transition interfaces.
- Home management and upgrades.
- Settings and connection status.

Menus should support gameplay without unnecessarily covering the world.

Every control must produce a defined outcome and appropriate feedback.

---

# 5. MULTIPLAYER ARCHITECTURE

## 5.1 Architectural requirement

OSOGBO LIFE is an online multiplayer product. The architecture must support real authenticated players in a shared world from the foundational implementation.

Do not design the game as single-player with multiplayer merely listed as a future possibility.

The first release may limit the number of players, districts, and social activities, but its core networking architecture must support actual multiplayer.

## 5.2 Separate transient and persistent state

**Transient multiplayer state** includes:
- Current movement.
- Current world position.
- Facing direction.
- Active animation state.
- Current multiplayer area.
- Short-lived interaction state.
- Connection and presence information.

This state belongs in the authoritative multiplayer runtime or appropriate real-time service.

**Persistent player state** includes:
- Account-linked profile.
- Character appearance and identity.
- Currency and validated transactions.
- Inventory ownership.
- Job progression.
- Home ownership and upgrades.
- Friend relationships.
- Persistent messages where supported.
- Last safe location or checkpoint.

This state belongs in appropriately protected backend storage.

Do not send database writes for every rendered frame.

## 5.3 Server authority

The server or trusted backend must validate important operations.

Do not trust the browser to determine:
- Currency balances.
- Rewards.
- Job completion.
- Item prices.
- Purchase success.
- Item ownership.
- Private-home access.
- Arbitrary travel or teleport requests.
- Friendship permissions.
- Private-message authorization.

Implement suitable validation, idempotency, rate limits, and transaction consistency.

## 5.4 Networking service evaluation

Evaluate a dedicated authoritative multiplayer runtime or suitable real-time multiplayer service against the actual project requirements.

The evaluation must consider:
- Phaser integration.
- React integration.
- Authentication.
- State synchronization.
- Room or area management.
- Reconnection.
- Authoritative movement.
- Hosting compatibility.
- Latency.
- Concurrent-player capacity.
- Operational complexity.
- Cost and scaling.

Supabase Realtime may be suitable for selected events or presence features, but do not assume it is sufficient for authoritative movement simulation.

Do not assume Vercel serverless functions can host a continuously running game server.

Recommend a specific architecture based on evidence, and document any remaining uncertainty before implementation.

---

# 6. SOCIAL SYSTEMS

## 6.1 Nearby players

Players must be able to:
- See other connected players in the same supported area.
- Approach and select another player.
- View a public character profile.
- Start a supported interaction.
- Receive feedback if the player becomes unavailable.
- Respect interaction distance and permission requirements.

## 6.2 Chat

Implement chat in stages, beginning with area or nearby chat and private messaging where supported.

Required behavior:
- Correct sender and recipient identity.
- Defined message channels.
- Server-side authorization.
- Input validation.
- Message-length limits.
- Spam prevention and rate limiting.
- Clear delivery failures.
- Appropriate persistence and retention rules.
- Reconnection behavior.

Do not make unrestricted global chat the only communication option.

## 6.3 Friends

Implement:
- Send, accept, reject, and cancel requests.
- Prevent duplicate or conflicting requests.
- Friends list.
- Appropriate online status.
- Authorization for relationship changes.
- Privacy controls for location visibility.

## 6.4 Safety and privacy

Plan for:
- Blocking.
- Muting.
- Reporting.
- Spam prevention.
- Access restrictions for private spaces.
- Protection of private messages and personal data.
- Appropriate moderation and report handling.

A blocked player must not bypass the relevant restrictions through alternate interaction paths.

## 6.5 Shared activities

The architecture must support future cooperative tasks and shared social activities.

Implement shared activities only when their dependencies are ready. A shared activity must have real multiplayer coordination and validated outcomes, not just a button that displays a placeholder alert.

---

# 7. CITY WORLD AND LOCATION MODEL

## 7.1 Custom world

Build an original fictional city inspired by Osogbo.

Do not use a literal real-world map as the gameplay map. Do not substitute a static illustration for an interactive world.

The world should consist of reusable tiles, sprites, collision data, interactive objects, buildings, entrances, and navigation rules.

Define:
- Districts.
- Streets and junctions.
- Walkable and blocked areas.
- Public spaces.
- Shops and workplaces.
- Residences.
- Building entrances and exits.
- NPC spawn locations.
- Destination points.
- World boundaries.
- Map asset loading and unloading.

Use a consistent coordinate system for movement, collisions, transitions, and persistence.

## 7.2 Area and district model

Represent the world as a collection of identifiable areas.

Each area should have an appropriate definition for:
- Stable area identifier.
- Display name.
- Map or scene reference.
- Spawn locations.
- Exit and entry points.
- Collision and navigation data.
- Multiplayer room or instance mapping.
- Required access rules.
- Asset dependencies.

Use existing conventions when appropriate. Do not create redundant data models when an equivalent already exists.

## 7.3 Buildings and interiors

Players must be able to:
1. Approach an entrance.
2. Receive interaction feedback.
3. Enter the correct building.
4. Navigate the interior.
5. Interact with supported objects.
6. Exit.
7. Return to the correct exterior location.

Implement reusable entrance and transition systems.

A navigable house interior must not be implemented as a modal overlay presented as if it were a separate world.

---

# 8. TRAVEL SYSTEM

Travel between locations is a core requirement.

## 8.1 Initial release

The first playable release must include:
- Walking within a neighborhood.
- At least two distinct playable areas.
- Entering and exiting at least one building.
- Correct transition positions.
- A location directory or equivalent destination discovery interface.
- A visible current-location indicator.
- Multiplayer-aware area transitions.
- Recovery from failed loading or disconnection.
- A valid saved checkpoint.

## 8.2 Expandable travel

Design for future:
- Additional districts.
- Shops and workplaces.
- Public areas.
- Player residences.
- Transport destinations.
- Buses, taxis, or other transport mechanics.

Transport can be implemented progressively, but the world architecture must support new destinations and travel methods without requiring a major rewrite.

## 8.3 Transition behavior

A transition must:
1. Validate the requested destination.
2. Verify access and applicable travel rules.
3. Remove or transfer the player from the old multiplayer area correctly.
4. Load or resolve the destination.
5. Spawn the player at the valid entry point.
6. Synchronize the new area with other players.
7. Preserve valid saved progression.
8. Recover safely if the transition fails.

Prevent duplicate player entities, stale room membership, and client-side teleport exploits.

---

# 9. GAMEPLAY AND PROGRESSION

The core progression loop is:

Explore → Interact → Accept task → Complete task → Validate result → Receive reward → Purchase item → Upgrade or use item → Save progress.

The initial playable release must include:
- At least one functional job or task.
- Server-validated currency rewards.
- Basic inventory.
- A working purchase.
- At least one purchasable upgrade.
- Persistent player progression.
- Clear feedback for success and failure.

Where a feature depends on another player or server, handle disconnection and retries safely.

Avoid embedding all game rules in React components or Phaser scenes. Keep progression definitions and domain operations maintainable.

---

# 10. DATA MODEL AND SECURITY

Inspect the existing schema before proposing changes.

Evaluate the data needed for:
- Player profiles.
- Characters.
- Saved locations.
- Currency and transactions.
- Inventory and item ownership.
- Jobs and task progress.
- Homes and furniture.
- Friend relationships.
- Chat messages.
- Blocking and reporting.
- Multiplayer session or area references, where persistent records are justified.

For each proposed table or operation, document its purpose, ownership, relationships, indexes, and access rules.

## Security requirements

- Never expose a service-role key in browser code.
- Use RLS for player-owned records.
- Verify identity and ownership on sensitive operations.
- Validate rewards and purchases on trusted server-side infrastructure.
- Prevent duplicate reward claims.
- Prevent negative balances and duplicate purchases.
- Use transactions or equivalent consistency mechanisms for related updates.
- Validate friendship and message authorization.
- Enforce private-home access rules.
- Apply rate limits and input validation.
- Avoid storing unnecessary sensitive data.
- Use appropriate audit records for economic transactions.

Do not trust local storage or browser state as the authority for valuable game assets.

Do not claim that a table, policy, or security issue exists until it has been verified.

---

# 11. FRONTEND AND GAME ARCHITECTURE

## React responsibilities

- Public website.
- Authentication and onboarding.
- HUD and menus.
- Chat and social interfaces.
- Inventory and shop interfaces.
- Dialogue and interaction menus.
- Travel directory.
- Settings and notifications.

## Phaser responsibilities

- World rendering.
- Movement and collision.
- Camera.
- Animation.
- NPC world behavior.
- Entrance and exit detection.
- World-side interaction targeting.
- Area and interior scenes.

## Domain and backend responsibilities

- Job and progression rules.
- Inventory and purchases.
- Travel authorization.
- Social permissions.
- Reward validation.
- Persistent save operations.
- Multiplayer authority and room management.

Define a typed communication contract between React and Phaser.

Prevent:
- Duplicate Phaser instances.
- Leaked event listeners.
- Competing state authorities.
- Database requests per frame.
- UI components directly controlling authoritative world state.
- Invalid or unvalidated gameplay commands.

---

# 12. DOMAIN AND DEPLOYMENT ARCHITECTURE

The intended product has two independently deployable frontend applications.

## Public website

Responsibilities:
- Landing page.
- Product information.
- Account entry.
- Play Now.
- Policies and help content.

## Game application

Responsibilities:
- Authentication/session validation.
- Character creation.
- Multiplayer world.
- Gameplay interfaces.
- Social systems.
- Travel.
- Player progression.

## Shared backend

Responsibilities:
- Authentication.
- Persistent player data.
- Authorized social operations.
- Economy and progression validation.
- Trusted multiplayer-related operations where appropriate.

Inspect the existing domain and Vercel configuration before recommending changes.

Document:
- Project boundaries.
- Build commands.
- Routing and asset paths.
- Environment-variable names.
- Authentication redirects.
- Allowed origins.
- Multiplayer server hosting.
- Development and production separation.

Do not change production DNS, authentication settings, or deployment configuration without explicit authorization.

---

# 13. PERFORMANCE AND MOBILE SUPPORT

Support desktop and mobile browsers from the first playable release.

## Desktop
- Keyboard movement.
- Pointer-based interactions.
- Readable HUD.
- Appropriate camera and canvas scaling.

## Mobile
- Touch movement controls.
- Accessible interaction buttons.
- Responsive HUD.
- Appropriate touch-target sizes.
- Safe viewport handling.
- Controls that do not obstruct important gameplay.

## Shared requirements
- Clean up scene and network resources.
- Handle tab visibility changes.
- Avoid unnecessary asset duplication.
- Load and unload world assets appropriately.
- Use efficient sprite atlases where beneficial.
- Handle slow networks and failed requests.
- Support reconnection and state recovery.
- Respect reduced-motion preferences for nonessential UI effects.

Measure actual performance before claiming that targets are met. Establish and document reasonable frame-rate, loading-time, and memory budgets based on the target devices.

---

# 14. REVISED IMPLEMENTATION MILESTONES

## Milestone 0 — Audit and design baseline
Audit the repository, document existing systems, identify defects, and finalize the architecture decisions.

## Milestone 1 — Architecture and design system
Establish the React–Phaser boundary, shared visual system, domain boundaries, world model, and multiplayer integration approach.

## Milestone 2 — Public homepage
Redesign the complete homepage and verify its navigation, calls to action, responsiveness, and game-world presentation.

## Milestone 3 — Authentication and onboarding
Implement the approved authentication flows, secure domain transitions, character creation, and returning-player flow.

## Milestone 4 — Multiplayer neighborhood
Implement a playable area, real multiplayer sessions, movement synchronization, presence, disconnect cleanup, and reconnection.

## Milestone 5 — Travel and interiors
Implement two distinct areas, building entry and exit, correct spawn points, and multiplayer-aware transitions.

## Milestone 6 — Social systems
Implement nearby-player interactions, profiles, chat, and friend requests, followed by relevant safety and privacy controls.

## Milestone 7 — Gameplay progression
Implement jobs, validated rewards, inventory, purchases, and one upgrade.

## Milestone 8 — Housing and expanded world
Implement home access, furniture upgrades, permitted visits, and expandable district support.

## Milestone 9 — Quality and release readiness
Verify security, multiplayer behavior, travel, persistence, desktop/mobile support, performance, and deployment readiness.

Adjust the sequence only where actual technical dependencies require it. Explain the reason for every adjustment.

Each milestone must specify:
- Objective.
- Actual files or systems affected.
- Dependencies.
- Implementation tasks.
- Acceptance criteria.
- Tests.
- Risks and rollback approach.

Do not begin all milestones at once. Complete and verify one coherent milestone at a time.

---

# 15. ACCEPTANCE TESTS

The implementation is not complete until the relevant tests pass.

## Website and authentication
- Homepage navigation and calls to action work.
- Layout is usable on desktop and mobile.
- Registration and login handle success and failure.
- Password recovery works.
- Protected routes reject invalid sessions.
- Website-to-game redirects work correctly.

## Multiplayer
- At least two independently authenticated clients join the same supported area.
- Both clients see the other player.
- Movement synchronizes with acceptable responsiveness.
- Players join and leave without stale entities.
- Reconnection restores a valid session and world state.

## Social
- Players can interact with nearby players.
- Chat authorization is enforced.
- Friend requests persist and reject invalid operations.
- Blocking and muting work according to their defined scope.
- Private information and private homes respect access rules.

## Travel
- Players can move between at least two distinct areas.
- Players can enter and exit a building.
- Return positions are correct.
- Area transitions do not duplicate players.
- Failed transitions recover safely.

## Progression
- Jobs have real completion conditions.
- Rewards are validated by trusted server-side logic.
- Duplicate reward claims are prevented.
- Purchases cannot produce invalid balances or duplicate ownership.
- Inventory and upgrades persist across sessions.

## Platform quality
- Phaser instances and event listeners are cleaned up correctly.
- Desktop and mobile controls work.
- Relevant error and loading states are tested.
- Security checks and database policies are verified.
- Build and regression tests pass.

Use multiple independent clients to verify multiplayer. Do not claim tests have passed unless they have actually been executed.

---

# 16. REQUIRED AUDIT REPORT

The audit report must include:

1. Executive summary.
2. Repository and framework inventory.
3. Existing feature inventory.
4. Verified explanation of current shortcomings.
5. Homepage redesign specification.
6. Authentication and onboarding specification.
7. Multiplayer architecture proposal.
8. Social interaction specification.
9. World and travel architecture.
10. Data model and security findings.
11. Domain and deployment plan.
12. Desktop/mobile and performance requirements.
13. Milestone implementation plan.
14. Prioritized findings register.
15. Unresolved technical decisions.
16. Test and acceptance checklist.

For each important finding, include:
- Severity: Critical, High, Medium, or Low.
- Evidence.
- Affected file or system.
- User or technical impact.
- Recommended action.
- Whether the finding is verified or still requires investigation.

Do not invent evidence, test results, files, or database objects.

---

# 17. FINAL ENGINEERING RULES

- Preserve working existing systems.
- Prefer incremental, testable changes over unnecessary rewrites.
- Do not simulate multiplayer with fake remote players.
- Do not substitute static images for interactive world systems.
- Do not claim a modal is a navigable interior.
- Do not claim a button is functional unless it produces the intended result.
- Do not trust the client for valuable game state.
- Do not write persistent player data on every frame.
- Do not expose secrets.
- Do not introduce unnecessary dependencies.
- Do not deploy or change production infrastructure without authorization.
- Document real limitations.
- Run tests after each coherent implementation milestone.

The final product must be a genuine online life-simulation game, not simply a redesigned website with a superficial game screen.

**All implementation must follow the approved milestone plan. Report actual changes and verification results after each milestone.**

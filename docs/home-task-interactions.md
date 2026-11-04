# Home interactions

The house camera supports horizontal and vertical swipes with bounded pitch. Shop mode keeps its fixed editing view. Floor taps move the character; swipes do not trigger floor or accessory clicks.

An accessory interaction follows this loop:

1. Choose a task from the accessory sheet, including its duration and benefits.
2. Walk through reachable floor cells, avoiding partitions and furniture. An inaccessible room requires a clear doorway; proximity across a wall is insufficient.
3. Start the existing authoritative simulation action after arrival.
4. Display the task pose, countdown and cancellation control.
5. Complete once the server reports enough connected task time. Existing receipts prevent duplicate effects.

Cancellation during walking does not start an action. Cancellation after starting interrupts the simulation without task benefits. Backgrounding, disconnecting or leaving the room aborts pending local walking/collection callbacks. Food collection uses its existing service after walking and a short collection animation.

Non-sleep home tasks take `max(3, min(30, ceil(game minutes / 2)))` real seconds. Existing sleep retains its 120-second connected-time and partial wake-up rules. Additional choices include naps, reading in bed, washing hands, cleaning the toilet, browsing, pruning, stretching and documentaries. The catalogue and migration declare their distinct effects; no cash rewards are added.

`20261103175006_home_task_interactions.sql` adds elapsed/duration columns and extends `personal_simulation_command` while retaining its ownership, furniture, session/revision, location, cooldown and receipt checks. A start retry retains elapsed time. The server caps heartbeat gaps at fifteen seconds and does not credit time on reconnect. Direct client timer writes remain prohibited by existing grants/RLS.

Apply this migration through the project's normal reviewed database workflow before enabling the new tasks on the hosted database. The UI blocks accessory starts when the server does not return the new timing contract. No hosted migration is applied by the implementation or its local tests.

Validation uses pure navigation tests, mocked camera and movement tests, accessory UI/snapshot tests, and PGlite migration tests. These checks do not establish authenticated hosted behavior or physical-device gesture performance.

## Hosted verification: 2026-11-04

After deployment approval, the task migration was found already recorded on the hosted database. Its function body and both timer columns were verified against the reviewed file. `20261104034408_secure_home_task_rpc.sql` was then applied to remove anonymous/public execution while retaining authenticated access. Both versions are recorded in the migration ledger. The simulation table has RLS enabled and only an owner SELECT policy, so its broad table grant does not permit direct client writes. Five database regression tests passed, including a reproduction and correction of the RPC grant drift. The restarted local preview returned HTTP 200 for `/` and `/house`; integrated-browser gameplay and physical-phone gestures remain unverified.

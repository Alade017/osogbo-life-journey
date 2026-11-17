# Hospital scene restoration

This branch is stacked on feature/campus-and-market-scenes (PR #54). Merge that base first, then retarget this PR to main.

## Scenes
Community Clinic uses a dedicated lazy-loaded grounds/cutaway scene, with reception, waiting lounge, examination, restroom and pharmacy. Staff and supply rooms are visible but excluded from visitor pathfinding. Existing health-post and hospital destination slugs use the shared reception model. The larger hospital tiers in the original blueprint are not implemented by this restoration.

The local walkthrough uses the existing movement hook. It does not save a second authoritative player position. Room selection and service state remain independent: walking to an exam room does not create or complete a visit.

## Server visit flow
Apply 0100_clinic_patient_flow.sql and 0101_clinic_staff_assignment.sql through the existing migration workflow after reviewing both migration ledgers. This branch appends their journal entries and does not change older migrations. It does not include the paused Korope migration.

Check-in, queue promotion, examination reservation, completion and cancellation are owned by clinic_visit_command. The function authenticates the user, verifies the current Community Clinic location, serializes a clinic's station updates, and restricts direct table writes. This fictional visit lifecycle does not apply health changes, diagnoses, charges or rewards.

Staff assignments derive from NPC records already configured to work at the active Community Clinic and their work-routine shifts. No NPC is fabricated by the UI or inserted under a fixed name. If no eligible record exists, configure a real clinic NPC and its clinic_staff_assignments row before enabling new visits. Off-duty or unconfigured clinics reject check-in. Existing appointments may finish after closing.

The UI validates service responses, stops polling on errors/idle/completed visits, and exposes manual availability refresh. A missing migration/service leaves the 3D tour usable but check-in unavailable.

## Validation and rollout
Five route smoke checks, sampled at 2,079 points, passed in a JavaScript translation of the recovered pure layout/navigation modules. Six restricted/invalid points and room/corridor separation checks also passed. This is not a repository Vitest run.

Saved navigation, controls, queue/permission/staff database tests and new response-validation tests are included. The executor is unavailable in this session, so repository tests, type checking, lint and live database migration verification have not been run. Hosted preview build status is reported on the PR. Do not treat the database tests as passed or apply these migrations based solely on a frontend build.

Review the preview at Community Clinic after confirmed travel. Verify exterior framing, cutaway visibility, room taps and controls on Android. Validate both SQL migrations in a disposable database before applying them to the live database. No live migrations were applied by this change.

# Tech Hub interior clarity

This is a visible update to the existing Harvest Tech Hub, not a new job system.

The cutaway now has a front entrance with an open door and threshold, framed back-wall windows with actual wall openings, wall trim, work/training floor zones and corner plants. The central aisle runs from the entrance toward the presentation area. Existing fixture anchors, names, inspection callbacks, camera framing, Jobs & shifts links and Courses links are preserved.

Selection outlines use the full presentation footprint of each furniture group, including chairs, instead of the same small ring for every item. These footprints and the entrance/aisle dimensions live in the shared workplace layout configuration. Regression checks cover room containment, furniture separation and a margin outside the central aisle.

The entrance is presentation geometry. This inspection scene does not acquire walkable player movement or a door interaction through this change. Existing neighborhood road-aware routing remains unchanged. Inspecting furnishings does not start shifts, pay wages, grant experience or enrol in courses; those actions stay in their existing flows.

Validation covers layout constraints, venue selection and scene configuration, typechecking, changed-file lint and production build. Real WebGL screenshots and mobile/desktop visual verification remain outstanding. No frame-rate improvement is claimed.

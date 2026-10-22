The latest production run, 37866213617 (attempt 4), flags the missing meetup photo on the progress page. That photo is bundled with the frontend. No image request failure appears in the job log; capture readiness remains a hypothesis until reproduced.

The screenshot readiness check uses image.complete, which also holds for failed images and does not establish decoding readiness. Extract that existing check so real-browser regression tests can exercise it, then require decoding before capture and report failed images.

The fixture dump excludes contract rows because migrations create them at the current time. Exclude that table from the fixture timestamp shift, which otherwise advances the active contract into the future.

# Realtime smoke (BE-12 + T-406), local, 2026-10-21

RESULT: PASS, 9/9. Backend 384f16c, app cb4889d. Local Reverb on 127.0.0.1:8080 (database queue, realtime queue worker), Debug build with WS_URL/WS_APP_KEY baked in, both sims (Ali, Bilal). Report text by rh-debugger, saved by the orchestrator.

1. Sign-in subscribes private-user.{me}; driver online adds private-driver.{me}; offline drops it. PASS
2. ride.requested broadcast the same second as booking; driver offer fetched 1 s later (not the 5 s poll); T-708 banner on Inbox. PASS
3. Accept → passenger "Driver is on the way"; private-ride.343 had 2 subscribers; "I've arrived" showed on both screens in the same second (in-ride poll is 10 s). PASS
4. driver_location every ~4 s (3 s throttle); passenger marker moved and turned smoothly. PASS
5. Chat both ways within ~2 s, unread badge, read ticks via chat.read. PASS
6. Complete → both sides left private-ride.343; cancel also drops it. PASS
7. Background closes the connection, foreground reconnects and resubscribes (both roles). PASS
8. Sign-out closes the connection; no reconnect or auth for 50 s; sign-in resubscribes. PASS
9. Reverb down: booking and offers still work by polling; reconnect within 13–20 s after restart; back-off grows (~9/10/11/17 s), no hot loop. PASS

Findings (not app bugs): hint jobs retry 3× with full stacks while Reverb is down (BE-138); `reverb:start --debug` logs auth signatures (production runs without --debug). T-710 LogBox toast not reproduced.

Env restored: backend BROADCAST_CONNECTION=log, app WS_APP_KEY removed (the installed build still has the smoke key; harmless while the server reports realtime off). Rides 341/342/344 cancelled, 343 completed.

# Food court and Buka scenes

The existing Riverside food court retains its street-food-market-yard GLB and fixture IDs. The existing neighborhood Buka zone gets an Explore Buka entry, a canteen scene with serving pots, bench dining and a wash point. Buka is not registered as a new server destination.

The shared menu reuses MarketPage with food-only filtering based on the existing inventory category helper. Prices, minimum quantities, stock, opening hours and purchase rules still come from the current shop catalogue and purchaseShopItem RPC. Undefined shop scope means open shops at the current server-confirmed location; a known shop slug scopes the menu to that shop, and null keeps no dedicated catalogue. The UI makes the location-wide scope explicit.

Purchased items go into the existing bag. Eating and drinking reuse itemUseEffect, validatePlayerAction and useInventoryItem. There is no automatic hunger recovery on purchase, no fixed meal bonus, and no second cart/checkout implementation. Home food delivery remains a separate flow. Existing legacy zone actions are unchanged.

Menu and bag data load when the disclosure opens. The room controls and menu remain available on 3D fallback. Food scenes do not add timers, fake queue counts, or duplicate transactions.

Repository regression tests are included but were not run in this environment. Hosted frontend build/deployment and actual phone review are tracked in the PR. No database migrations or new renderer dependencies.

# Coordinator real-browser QA — M0 experience

Source: Claude task branch at f1fc0b4a954c0012f527970415b2a15dd650927e.
Started actual loopback application at http://127.0.0.1:8876 and used Chrome in isolated
opendevin-qa context. No synthetic backend responses were injected.

Verified: title/navigation brand OpenDevin; labeled Ask/Repositories/Settings links;
sample workspace label; submit checkout example produces 1 answer and 16 citation links;
first citation opens numbered storefront source; Repositories shows 4 rows and route focus
moves to Repositories heading; Settings truthfully shows legacy-404 status unavailable;
returning to Ask preserves answer and open source pane. No UI error appeared in the flow.
These checks exercise real browser DOM/network behavior. They do not prove screen-reader
compatibility or integrated M0 health routes, which require later integration checks.
Coordinator separately ran node --test tests/ui/*.test.mjs: 14 tests passed.

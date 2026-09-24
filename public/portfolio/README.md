# Published portfolio

`portfolio.json` is served with the site at `<base>/portfolio/portfolio.json`. Every visitor sees its entries as read-only completed work in **My Challenges** and on the dashboard, with no setup and no API key.

## Publishing

1. Solve challenges in the app. Only submissions that pass every test, hidden tests included, count as completed.
2. Optionally add approach notes from each challenge's portfolio view.
3. Go to **Settings → Data → Export portfolio**. The export contains only completed challenges, each with the exact solution that passed. It never contains unfinished work, settings or API keys.
4. Replace `portfolio.json` in this folder with the exported file, then commit and push. CI validates the file (`tests/integration/published-portfolio.test.ts`) before deploying.

The file starts with an empty `attempts` list. The site shows only work that has actually been completed.

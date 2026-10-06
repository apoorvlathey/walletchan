# Telegram Integration (Retired Deployment)

The Telegram bot and legacy BNKRW staking indexer Railway projects were scheduled
for deletion on 2026-10-06. The bot deployment was stopped before removing the
indexer, so stopping these services does not kick existing group members.

The website's `/verify` page remains in this repository. Its sWCHAN balance
lookup still uses the running WCHAN vault indexer, but bot API calls cannot
complete while the bot service is retired. Removing or redesigning that page
is a separate product change; this repository split does not change it.

# Seed backup reminder

- `useSeedBackupState.ts` reads public group metadata, subscribes to group/account
  changes and persists only an explicit master-authorized acknowledgment.
- `SeedBackupConfirmation.tsx` renders the saved-words checkbox and Finish backup
  commitment. The checkbox alone enables Finish backup; showing or copying words
  is not tracked. RevealSeedPhrase retains explicit password verification and words.

The reminder is group-specific and independent of selected accounts. Showing,
copying or leaving the phrase screen does not complete backup.

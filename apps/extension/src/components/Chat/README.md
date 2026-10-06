# Chat UI audit map

- `ChatView.tsx` coordinates conversation-list and active-chat modes.
- Home's chat action opens a fresh unsaved conversation. The conversation
  header exposes History and New Chat; the history header retains New Chat.
- `ChatList.tsx` renders saved conversation choices.
- `ChatHeader.tsx`, `ChatInput.tsx`, and `MessageList.tsx` compose the active
  conversation surface.
- `MessageBubble.tsx` renders one user or assistant message.
- Message actions sit below content with its timestamp. Errors expose recovery
  actions and never a copy button; only the latest error offers retry. The
  amber composer grows for multiline drafts and keeps drafts editable during
  polling while submission and resend are disabled. Changing conversations
  clears the composer; resumed pending conversations restore the busy state.
- `preview/chatFixtures.ts` covers replies, API-access errors, generic errors,
  locked sessions, pending work, and history for visual QA.
- `ShapesLoader.tsx` is the feature loading treatment. Its default adapts to
  the active theme; `variant="dots"` provides the shared monochrome pulse used
  when a filled control needs a fixed-contrast loading state.

Chat state and background messaging enter through the feature controller/hook;
message presentation must not duplicate credential or Bankr authorization
policy.

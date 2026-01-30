# React Performance Optimizations

## Summary

Reduced initial bundle size from **879KB to 45KB** (95% reduction) through code splitting, lazy loading, and memoization.

## Changes Made

### 1. Vite Manual Chunks (vite.config.ts, vite.config.onboarding.ts)

Split vendor libraries into separate cacheable chunks:

```js
manualChunks: {
  "vendor-react": ["react", "react-dom"],
  "vendor-chakra": ["@chakra-ui/react", "@chakra-ui/icons", "@emotion/react", "@emotion/styled", "framer-motion"],
  "vendor-ethers": ["@ethersproject/address", "@ethersproject/bytes", "@ethersproject/logger", "@ethersproject/providers"],
}
```

**Benefits:**
- Browser caches vendor chunks independently
- Code changes don't invalidate vendor cache
- Parallel chunk loading

### 2. React.lazy() for Heavy Components (App.tsx)

Lazy load views that aren't needed on initial render:

```tsx
const Settings = lazy(() => import("@/components/Settings"));
const TransactionConfirmation = lazy(() => import("@/components/TransactionConfirmation"));
const SignatureRequestConfirmation = lazy(() => import("@/components/SignatureRequestConfirmation"));
const PendingTxList = lazy(() => import("@/components/PendingTxList"));
```

**Benefits:**
- Initial bundle only includes critical code
- Heavy components load on-demand
- Faster time-to-interactive

### 3. React.memo() on Components

Added memoization to prevent unnecessary re-renders:

- `Settings`
- `TransactionConfirmation`
- `SignatureRequestConfirmation`
- `PendingTxList`
- `PendingTxBanner`
- `TxStatusList`
- `UnlockScreen`

### 4. useCallback for Handlers (App.tsx)

Memoized event handlers to maintain referential equality:

```tsx
const handleUnlock = useCallback(async () => { ... }, []);
const handleTxConfirmed = useCallback(async () => { ... }, [selectedTxRequest?.id]);
const handleTxRejected = useCallback(async () => { ... }, [selectedTxRequest?.id, isInSidePanel]);
const handleRejectAll = useCallback(async () => { ... }, [pendingRequests, pendingSignatureRequests, isInSidePanel]);
const handleSignatureCancelled = useCallback(async () => { ... }, [selectedSignatureRequest?.id, isInSidePanel]);
const handleCancelAllSignatures = useCallback(async () => { ... }, [pendingSignatureRequests, isInSidePanel]);
```

**Benefits:**
- Child components don't re-render when parent state changes
- Better performance with React.memo

## Results

### Main Bundle (popup/sidepanel)

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| main.js | 879 KB | 45 KB | **95% smaller** |
| gzip | 268 KB | 11 KB | **96% smaller** |

### Onboarding Bundle

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| onboarding.js | 713 KB | 296 KB | **58% smaller** |
| gzip | 222 KB | 93 KB | **58% smaller** |

### Chunk Architecture

```
main.js                          45 KB  (critical path)
vendor-chakra                   521 KB  (cached separately)
vendor-ethers                   273 KB  (cached separately)
TransactionConfirmation           9 KB  (lazy loaded)
SignatureRequestConfirmation      7 KB  (lazy loaded)
PendingTxList                     6 KB  (lazy loaded)
Settings (index chunk)           20 KB  (lazy loaded)
```

## Load Time Impact

1. **First Visit**: ~840KB total, but main.js (45KB) loads first for faster interactivity
2. **Return Visits**: Only 45KB if vendor chunks are cached
3. **View Navigation**: Lazy chunks load on-demand (~6-20KB each)

## Future Optimizations

Consider if needed:
- Tree-shake unused Chakra UI components with `@chakra-ui/react` modular imports
- Preload critical lazy chunks with `<link rel="prefetch">`
- Service worker caching for offline support

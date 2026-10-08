"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  LoaderCircle,
  Lightbulb,
} from "lucide-react";
import { palette } from "../home-v2/design";
import { CHROME_STORE_URL } from "../constants";
import { useSiteNav } from "../lib/useSiteNav";
import { BUNKER_CHAINS, verdictFor, type ChainResult } from "./model";
import {
  isCheckableInput,
  resolveProfile,
  resolveIdentity,
  scanChain,
  type Identity,
} from "./rpc";
import { renderCard } from "./card";
import "./bunker.css";
import BunkerScan, { NetworkBreakdown } from "./BunkerScan";
import BunkerShareModal from "./BunkerShareModal";
import Mascot from "./Mascot";
import { TweetCard } from "../components/ui/TweetCard";
const PAGE_URL = "https://walletchan.com/bunker-mode";
export default function BunkerMode() {
  const { homeHref } = useSiteNav();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [identity, setIdentity] = useState<Identity>();
  const [results, setResults] = useState<ChainResult[]>([]);
  const anonymous = false;
  const [card, setCard] = useState<{ blob: Blob; url: string }>();
  const [shareStatus, setShareStatus] = useState("");
  const [copyingCard, setCopyingCard] = useState(false);
  const [showOpenX, setShowOpenX] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const closeShareModal = useCallback(() => setShareModalOpen(false), []);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (busy) {
      form.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
  }, [busy]);
  const controller = useRef<AbortController | undefined>(undefined);
  const generation = useRef(0);
  useEffect(() => () => controller.current?.abort(), []);
  const verdict = verdictFor(results);
  const done = !!card && !busy;
  useEffect(() => {
    return () => {
      if (card) URL.revokeObjectURL(card.url);
    };
  }, [card]);
  async function run(event?: FormEvent, value = input) {
    event?.preventDefault();
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const runId = ++generation.current;
    setBusy(true);
    setError("");
    setCard(undefined);
    setShareStatus("");
    setShowOpenX(false);
    let current: ChainResult[] = [];
    setResults(current);
    setStage("Resolving your address");
    try {
      const who = await resolveIdentity(value);
      if (abort.signal.aborted) return;
      setIdentity(who);
      setStage("Scanning public networks");
      // Fetch profile alongside chain checks, but publish only the final card.
      const profilePromise = resolveProfile(who).catch(() => who);
      const pending = BUNKER_CHAINS;
      await Promise.all(
        pending.map(async (chain) => {
          const result = await scanChain(chain, who.address, abort.signal);
          if (abort.signal.aborted) return;
          current = [...current, result];
          setResults(
            [...current].sort(
              (a, b) =>
                BUNKER_CHAINS.findIndex((c) => c.id === a.chain.id) -
                BUNKER_CHAINS.findIndex((c) => c.id === b.chain.id),
            ),
          );
        }),
      );
      if (abort.signal.aborted || generation.current !== runId) return;
      setStage("Finishing name and avatar lookup");
      const profile = await profilePromise;
      if (abort.signal.aborted || generation.current !== runId) return;
      setStage("Preparing your card");
      const blob = await renderCard({
        identity: profile,
        results: current,
        verdict: verdictFor(current),
        checkedAt: new Date().toISOString(),
        anonymous,
      }).catch(() => {
        throw new Error("Card export failed. Please try the check again.");
      });
      if (abort.signal.aborted || generation.current !== runId) return;
      setIdentity(profile);
      setCard({ blob, url: URL.createObjectURL(blob) });
    } catch (err) {
      if (!abort.signal.aborted)
        setError(
          err instanceof Error && /Enter|name|address|Card export/.test(err.message)
            ? err.message
            : "Could not resolve that name. Check it and try again.",
        );
    } finally {
      if (generation.current === runId && !abort.signal.aborted) setBusy(false);
    }
  }
  function cancel() {
    controller.current?.abort();
    generation.current++;
    setBusy(false);
    setResults([]);
    setIdentity(undefined);
    setCard(undefined);
    setStage("");
  }
  const failed = results.filter((r) => r.status === "error").length;
  const shareText = `Is your address ready for "bunker mode"? ${verdict === "clean" ? "mine is ✨" : "mine isn't 💀"}\n\ncheck out ${PAGE_URL}`;
  const postUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  async function postOnX() {
    if (!card || copyingCard) return;
    setCopyingCard(true);
    setShowOpenX(false);
    setShareStatus("Copying your card…");
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
        throw new Error("Image clipboard unavailable");
      // The PNG is ready before the click. Start writing while the page still
      // has focus and user activation, before opening the tweet composer.
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": card.blob }),
      ]);
      setShareStatus("");
      setShareModalOpen(true);
    } catch {
      setShareStatus("Couldn't copy the card. Download it and attach it on X.");
      setShowOpenX(true);
    } finally {
      setCopyingCard(false);
    }
  }
  function download() {
    if (!card) return;
    const link = document.createElement("a");
    link.href = card.url;
    link.download = `walletchan-bunker-${verdict}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setShareStatus("Card saved. Attach it to your post on X.");
  }
  return (
    <div
      className="bunker-page"
      style={
        {
          "--bunker-bg": palette.ink,
          "--bunker-surface": palette.ink2,
          "--bunker-text": palette.white,
          "--bunker-muted": palette.muted,
          "--bunker-brand": palette.yellow,
        } as React.CSSProperties
      }
    >
      <header className="bunker-header">
        <a className="bunker-logo" href={homeHref}>
          <img
            src="/images/walletchan-icon-nobg.png"
            alt=""
            width="32"
            height="32"
          />
          <span>WALLETCHAN</span>
        </a>
        <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer">
          <img src="/images/browsers/chrome.svg" width="16" height="16" alt="" />
          Get the wallet
        </a>
      </header>
      <main className="bunker-main">
        <div className="bunker-lead">
          <div>
            <h1>Bunker mode.</h1>
            <p className="bunker-intro">
              Is your address <span>safe</span>?
            </p>
          </div>
          {!done && <Mascot mood="idle" />}
        </div>
        <form
          ref={form}
          onSubmit={run}
          className="bunker-form"
          autoComplete="off"
          data-form-type="other"
        >
          <label htmlFor="bunker-address">Ethereum address or name</label>
          <div className="bunker-input-row">
            <input
              id="bunker-address"
              type="text"
              name="wallet-address-search"
              data-1p-ignore
              data-lpignore="true"
              data-bwignore="true"
              data-form-type="other"
              placeholder="0x… / .eth / .gwei / .wei"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setResults([]);
                setIdentity(undefined);
                setCard(undefined);
                setShareStatus("");
                setError("");
              }}
              onPaste={(event) => {
                const field = event.currentTarget;
                const pasted = event.clipboardData.getData("text");
                const next = (
                  input.slice(0, field.selectionStart ?? input.length) +
                  pasted +
                  input.slice(field.selectionEnd ?? input.length)
                ).trim();
                if (!isCheckableInput(next)) return;
                event.preventDefault();
                setInput(next);
                void run(undefined, next);
              }}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              required
              maxLength={255}
            />
            <button type="submit" disabled={busy || !input.trim()}>
              {busy ? <LoaderCircle className="bunker-spin" size={18} /> : null}
              {busy ? "Checking…" : "Check"}
            </button>
          </div>
        </form>
        {error && (
          <p className="bunker-error" role="alert">
            {error}
          </p>
        )}
        <BunkerScan
          busy={busy}
          done={done}
          stage={stage}
          results={results}
          identity={identity}
          anonymous={anonymous}
          card={card}
          verdict={verdict}
          cancel={cancel}
        />
        {done && (
          <>
            <div className="bunker-share-actions">
              <button
                type="button"
                className="bunker-post-button"
                onClick={postOnX}
                disabled={!card || copyingCard}
                title="Copies your card so you can paste it into your tweet"
              >
                {copyingCard ? "Copying card…" : "Post on 𝕏"}
                <ArrowUpRight size={17} />
              </button>
              <button onClick={download} disabled={!card}>
                <ArrowDownToLine size={17} /> Download card
              </button>
            </div>
            {shareStatus && <p className="bunker-share-note" role="status" aria-live="polite">
              {shareStatus}
              {showOpenX && (
                <> <a href={postUrl} target="_blank" rel="noopener noreferrer">Open X <ArrowUpRight size={12} /></a></>
              )}
            </p>}

            <NetworkBreakdown results={results}>
              <p className="bunker-caveat">
                <Lightbulb size={16} aria-hidden="true" />
                <span>
                  Zero nonce on checked mainnets does not rule out offchain
                  signatures, pending transactions, testnets, or other chains.
                  Contract accounts have no private key of their own. This is an
                  onchain signal, not a security guarantee.
                </span>
              </p>
            </NetworkBreakdown>
            {failed > 0 && (
              <button className="bunker-retry" onClick={() => run()}>
                Recheck all networks ({failed} unavailable)
              </button>
            )}
          </>
        )}
        <section
          className="bunker-tweet"
          aria-label="Justin Drake’s bunker mode post"
        >
          <TweetCard tweetId="2107837081313505768" decoratorShape={null} />
        </section>
      </main>
      <footer className="bunker-footer">
        <p>
          Requests go directly to public RPC providers. WalletChan does not
          store your address.
        </p>
      </footer>
      {shareModalOpen && <BunkerShareModal postUrl={postUrl} onClose={closeShareModal} />}
    </div>
  );
}

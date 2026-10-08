"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";

export default function BunkerShareModal({
  postUrl,
  onClose,
}: {
  postUrl: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const remaining = useRef(3000);
  const attempted = useRef(false);
  const [milliseconds, setMilliseconds] = useState(3000);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const paused = hovered || focused;
  const openComposer = useCallback(() => {
    const composer = window.open(postUrl, "_blank");
    if (composer) {
      composer.opener = null;
      onClose();
    } else {
      setBlocked(true);
    }
  }, [postUrl, onClose]);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (paused || blocked || attempted.current) return;
    let frame = 0;
    let last = performance.now();
    function tick(now: number) {
      remaining.current = Math.max(0, remaining.current - (now - last));
      last = now;
      setMilliseconds(remaining.current);
      if (remaining.current === 0) {
        attempted.current = true;
        openComposer();
      } else {
        frame = requestAnimationFrame(tick);
      }
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, blocked, openComposer]);

  const fill = paused || blocked ? 1 : 1 - milliseconds / 3000;
  return (
    <dialog
      ref={dialog}
      className="bunker-share-modal"
      aria-labelledby="bunker-share-title"
      aria-describedby="bunker-share-instructions"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}
    >
      <button type="button" className="bunker-modal-close" onClick={onClose} aria-label="Close sharing instructions" autoFocus>
        <X size={18} />
      </button>
      <h2 id="bunker-share-title">Card copied.</h2>
      <p id="bunker-share-instructions">Paste your card into the post on X.</p>
      <button
        type="button"
        className="bunker-modal-post"
        onClick={openComposer}
        onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <span className="bunker-modal-progress" style={{ transform: `scaleX(${fill})` }} />
        <span className="bunker-modal-post-label">Post on 𝕏 <ArrowUpRight size={17} /></span>
        {!paused && !blocked && <span className="bunker-modal-seconds">{Math.ceil(milliseconds / 1000)}s</span>}
      </button>
      <p className="bunker-modal-timing" role="status">
        {blocked ? "Click Post on 𝕏 to open the composer."
          : ""}
      </p>
    </dialog>
  );
}

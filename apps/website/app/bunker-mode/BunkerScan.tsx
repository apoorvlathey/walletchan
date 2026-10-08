import { Check } from "lucide-react";
import BunkerCard from "./BunkerCard";
import {
  BUNKER_CHAINS,
  cardCopy,
  type ChainResult,
  type Verdict,
} from "./model";
import type { Identity } from "./rpc";
type Props = {
  busy: boolean;
  done: boolean;
  stage: string;
  results: ChainResult[];
  identity?: Identity;
  anonymous: boolean;
  card?: { url: string };
  verdict: Verdict;
  cancel: () => void;
};
export default function BunkerScan({
  busy,
  done,
  stage,
  results,
  identity,
  anonymous,
  card,
  verdict,
  cancel,
}: Props) {
  if (!busy && !done) return null;
  const copy = cardCopy(verdict, results);
  return (
    <section
      className={`bunker-stage ${busy ? "is-scanning" : ""}`}
      aria-label="Network scan"
    >
      {busy && (
        <div className="bunker-scan-head">
          <p role="status">
            {stage}
            <span>
              {results.length} / {BUNKER_CHAINS.length}
            </span>
          </p>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
      )}
      {busy && (
        <div className="bunker-progress">
          <div
            style={{
              transform: `scaleX(${(results.length / BUNKER_CHAINS.length) * 0.9})`,
            }}
          />
        </div>
      )}
      {done &&
        (card ? (
          <BunkerCard
            src={card.url}
            alt={`${copy.title}. ${anonymous ? "Anonymous address" : identity?.name || identity?.address}. ${copy.caption}`}
          />
        ) : (
          <div className="bunker-card-loading" role="status">
            Preparing your card…
          </div>
        ))}
      {busy && <NetworkBreakdown results={results} />}
    </section>
  );
}

export function NetworkBreakdown({
  results,
  children,
}: {
  results: ChainResult[];
  children?: React.ReactNode;
}) {
  return (
    <section className="bunker-networks" aria-label="Details Checked">
      <div className="bunker-network-heading">
        Details Checked{" "}
        <span>
          {results.length}/{BUNKER_CHAINS.length}
        </span>
      </div>
      <div className="bunker-network-grid">
        {BUNKER_CHAINS.map((chain) => {
          const result = results.find((r) => r.chain.id === chain.id);
          return (
            <div
              key={chain.id}
              className={`bunker-network ${result?.status || "pending"}`}
            >
              <span className="bunker-network-name">
                <img
                  src={chain.icon}
                  data-chain={chain.id}
                  alt=""
                  width="18"
                  height="18"
                />
                {chain.name}
              </span>
              <span>
                {!result ? (
                  "Checking"
                ) : result.status === "clean" ? (
                  <>
                    <Check size={12} /> 0
                  </>
                ) : result.status === "error" ? (
                  "Unavailable"
                ) : result.status === "contract" ? (
                  "Contract"
                ) : (
                  `Nonce ${result.nonce}`
                )}
              </span>
            </div>
          );
        })}
      </div>
      {children}
    </section>
  );
}

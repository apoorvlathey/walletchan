import { mascotLayers } from "./mascotLayers";
import type { Verdict } from "./model";
export default function Mascot({ mood = "idle" }: { mood?: Verdict | "idle" }) {
  return (
    <div className="bunker-mascot" aria-hidden="true">
      {mascotLayers(mood).map((src) => (
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          width={1024}
          height={1024}
        />
      ))}
    </div>
  );
}

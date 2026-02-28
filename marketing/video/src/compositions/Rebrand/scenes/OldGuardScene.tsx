import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * Scene 1 — The Old Guard (50 frames / ~1.7s)
 * Shadow silhouette visible from frame 0, shatters at frame 20.
 * Background becomes transparent during shatter so the Reveal scene
 * (layered below) shows through the gaps.
 */

const LogoFragment: React.FC<{
  clipPath: string;
  dx: number;
  dy: number;
  rotation: number;
  dissolveProgress: number;
}> = ({ clipPath, dx, dy, rotation, dissolveProgress }) => {
  return (
    <Img
      src={staticFile("bnkrw-shadow.jpg")}
      style={{
        position: "absolute",
        width: 200,
        height: 200,
        borderRadius: 24,
        clipPath,
        transform: `translate(${dx * dissolveProgress}px, ${dy * dissolveProgress}px) rotate(${rotation * dissolveProgress}deg)`,
        opacity: 1 - dissolveProgress,
      }}
    />
  );
};

export const OldGuardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Dissolve starts at frame 20
  const dissolveProgress = interpolate(frame, [20, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // White bg fades out as shatter begins, revealing RevealScene beneath
  const bgOpacity = interpolate(frame, [18, 28], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle float before dissolve
  const floatY = frame < 20 ? Math.sin(frame * 0.1) * 3 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: `rgba(255,255,255,${bgOpacity})` }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          transform: `translateY(${floatY}px)`,
        }}
      >
        {/* Before dissolve: shadow silhouette */}
        {dissolveProgress === 0 && (
          <Img
            src={staticFile("bnkrw-shadow.jpg")}
            style={{
              width: 200,
              height: 200,
              borderRadius: 24,
            }}
          />
        )}

        {/* During dissolve: 4 fragments flying apart */}
        {dissolveProgress > 0 && (
          <div style={{ position: "relative", width: 200, height: 200 }}>
            <LogoFragment
              clipPath="inset(0 50% 50% 0)"
              dx={-80}
              dy={-60}
              rotation={-15}
              dissolveProgress={dissolveProgress}
            />
            <LogoFragment
              clipPath="inset(0 0 50% 50%)"
              dx={80}
              dy={-50}
              rotation={12}
              dissolveProgress={dissolveProgress}
            />
            <LogoFragment
              clipPath="inset(50% 50% 0 0)"
              dx={-70}
              dy={70}
              rotation={-8}
              dissolveProgress={dissolveProgress}
            />
            <LogoFragment
              clipPath="inset(50% 0 0 50%)"
              dx={75}
              dy={60}
              rotation={18}
              dissolveProgress={dissolveProgress}
            />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

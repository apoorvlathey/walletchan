import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const SceneTransition: React.FC<{
  children: React.ReactNode;
  enterFrame: number;
  exitFrame: number;
  durationFrames: number;
}> = ({ children, enterFrame, exitFrame, durationFrames }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const transitionDuration = 8;

  // Enter: slide in from right
  const enterProgress = interpolate(
    frame,
    [enterFrame, enterFrame + transitionDuration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Exit: slide out to left
  const exitProgress = interpolate(
    frame,
    [exitFrame - transitionDuration, exitFrame],
    [0, -1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const translateX = (enterProgress + exitProgress) * width;

  // Don't render if not in range
  if (frame < enterFrame - transitionDuration || frame > exitFrame) return null;

  return (
    <AbsoluteFill
      style={{
        transform: `translateX(${translateX}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

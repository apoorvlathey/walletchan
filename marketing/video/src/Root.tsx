import { Composition } from "remotion";
import { AIAgentsNeedWallets } from "./compositions/AIAgentsNeedWallets";
import { V1Launch } from "./compositions/V1Launch";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AIAgentsNeedWallets"
        component={AIAgentsNeedWallets}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="V1Launch"
        component={V1Launch}
        durationInFrames={1500}
        fps={30}
        width={1080}
        height={1080}
      />
    </>
  );
};

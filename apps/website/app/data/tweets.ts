// Extract tweet ID from URL (supports x.com and twitter.com)
export function getTweetId(url: string): string {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : url;
}

export const tweets: string[] = [
  "https://x.com/0xDeployer/status/2017318939928498365",
  "https://x.com/saintniko/status/2017328160765870428",
  "https://x.com/fey_xbt/status/2017338455286583372",
  "https://x.com/apoorveth/status/2017393788059324763",
  "https://x.com/Marczeller/status/2017579201692401816",
  "https://x.com/bankrbot/status/2017319052155523317",
  "https://x.com/jessepollak/status/2017451199277261182",
  "https://x.com/BoredElonMusk/status/2017323831858532709",
  "https://x.com/0xPolygon/status/2017365893441810852",
  "https://x.com/0x_ultra/status/2017322254825079219",
  "https://x.com/0xcyp/status/2017959269677584862",
];

// Extract tweet ID from URL (supports x.com and twitter.com)
export function getTweetId(url: string): string {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : url;
}

export interface TweetEntry {
  url: string;
  hideQuotedTweet?: boolean;
}

export const tweets: TweetEntry[] = [
  {
    url: "https://x.com/0xDeployer/status/2017318939928498365",
    hideQuotedTweet: true,
  },
  { url: "https://x.com/saintniko/status/2017328160765870428" },
  { url: "https://x.com/fey_xbt/status/2017338455286583372" },
  { url: "https://x.com/Marczeller/status/2017579201692401816" },
  {
    url: "https://x.com/bankrbot/status/2017319052155523317",
    hideQuotedTweet: true,
  },
  { url: "https://x.com/jessepollak/status/2017451199277261182" },
  { url: "https://x.com/BoredElonMusk/status/2017323831858532709" },
  { url: "https://x.com/0xPolygon/status/2017365893441810852" },
  { url: "https://x.com/0x_ultra/status/2017322254825079219" },
  { url: "https://x.com/0xcyp/status/2017959269677584862" },
];

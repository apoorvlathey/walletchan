import { NextResponse } from 'next/server';

const EXTENSION_ID = process.env.EXTENSION_ID!;
const GITHUB_REPO = 'apoorvlathey/bankr-wallet';

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

export async function GET() {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { next: { revalidate: 300 } } // 5 min cache
    );

    if (!response.ok) {
      return new NextResponse(fallbackXml(EXTENSION_ID), xmlHeaders());
    }

    const release: GitHubRelease = await response.json();
    const version = release.tag_name.replace(/^v/, '');
    const crxAsset = release.assets.find((a) => a.name.endsWith('.crx'));

    if (!crxAsset) {
      return new NextResponse(fallbackXml(EXTENSION_ID), xmlHeaders());
    }

    const xml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${EXTENSION_ID}'>
    <updatecheck codebase='${crxAsset.browser_download_url}' version='${version}'/>
  </app>
</gupdate>`;

    return new NextResponse(xml, xmlHeaders());
  } catch {
    return new NextResponse(fallbackXml(EXTENSION_ID), xmlHeaders());
  }
}

function fallbackXml(id: string) {
  return `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${id}'>
    <updatecheck version='0.0.0'/>
  </app>
</gupdate>`;
}

function xmlHeaders() {
  return {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=300',
    },
  };
}

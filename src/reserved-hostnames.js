// TEMPO Slider - 予約済みホスト名リスト
//
// 「+ Add this site」で追加すると不具合の原因になるホスト名を列挙する。
// 内訳:
//   - すでに静的 manifest / DNR で組み込み対応している音楽サイト群
//     （追加しても何も得がなく、動的 DNR ルールが重複・上書きして
//      予期しない CORS / CSP 改変を引き起こす）
//   - Google や Akamai 等のインフラ系
//     （子サブドメインで認証付き API が動いており、CORS ヘッダーを
//      改変するとアップロード等が壊れる）
//
// このリストは popup.js（追加前の検証）、background.js（実行時検証 +
// 起動時の自動クリーンアップ）の両方から参照される。

const RESERVED_HOSTNAMES = [
  // 組み込みで対応済みの音楽サイト + そのCDN
  'bandcamp.com',
  'bcbits.com',
  'beatport.com',
  'traxsource.com',
  'discogs.com',
  'youtube.com',
  'youtube-nocookie.com',
  // インフラ系（改変するとGoogle製品やCDN配信が壊れる）
  'google.com',
  'googleapis.com',
  'googleusercontent.com',
  'googlevideo.com',
  'gstatic.com',
  'akamaized.net',
];

function isReservedHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  const h = hostname.toLowerCase().trim();
  for (const reserved of RESERVED_HOSTNAMES) {
    if (h === reserved || h.endsWith('.' + reserved)) {
      return true;
    }
  }
  return false;
}

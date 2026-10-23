/**
 * 通过浏览器 User-Agent 判断是否为手机 / 平板，避免触屏笔记本被误判为移动端。
 */
const MOBILE_UA =
  /Android|iPhone|iPad|iPod|Windows Phone|IEMobile|Opera Mini|Mobile|HarmonyOS|OpenHarmony|BlackBerry|Kindle|Silk/i;

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (MOBILE_UA.test(ua)) return true;
  // iPadOS 13+ 的桌面版 Safari 会把 UA 伪装成 Macintosh，用触点数量补充判断
  return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

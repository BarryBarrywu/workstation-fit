const chinaEntry = location.hostname === 'barrybarrywu.cn' || location.hostname.endsWith('.barrybarrywu.cn');
if (chinaEntry) {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    link.href = link.href.replace(/^(https?:\/\/)((?:(?:www|tutti|keyphore|naban|fit|warmkitty|sponsor)\.)?barrybarrywu)\.com(?=[:/?#]|$)/, '$1$2.cn');
  }
}

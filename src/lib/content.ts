export type BrandIconName = 'bilibili' | 'youtube' | 'wechat' | 'douyin' | 'xiaohongshu' | 'placeholder' | 'github' | 'tutti';

export type EpisodeDestination = {
  label: string;
  icon: BrandIconName;
  url: string | null;
  pendingLabel?: string;
  actionLabel?: string;
  kind?: 'product';
};

export type RelatedLink = {
  label: string;
  description: string;
  icon: BrandIconName;
  url: string;
  meta: string;
};

export const relatedEpisode = {
  title: '从建议数值，到真实工位。',
  summary: '相关视频会演示怎样把这些建议用到桌子、椅子和显示器上。发布后，可以从下面的平台观看。',
  cover: null as string | null,
  coverAlt: '相关视频封面',
  destinations: [
    { label: 'B站', icon: 'bilibili', url: null },
    { label: 'YouTube', icon: 'youtube', url: null },
    { label: '微信公众号', icon: 'wechat', url: null },
    { label: '抖音', icon: 'douyin', url: null },
    { label: '小红书', icon: 'xiaohongshu', url: null },
    {
      label: '本期商品链接',
      icon: 'placeholder',
      url: null,
      pendingLabel: '待补充',
      actionLabel: '查看',
      kind: 'product',
    },
  ] satisfies EpisodeDestination[],
};

export const relatedLinks = [
  {
    label: '合身工位 · GitHub',
    description: '项目仓库目前仍在整理中。公开后，可以在这里查看源码、计算方法和后续更新。',
    icon: 'github',
    url: 'https://github.com/BarryBarrywu/workstation-fit',
    meta: '暂未公开',
  },
  {
    label: 'Tutti for Mac',
    description: '一款 macOS 菜单栏音频工具，让多台输出设备同时播放，并集中控制设备和每个 App 的音量。',
    icon: 'tutti',
    url: 'https://tutti.barrybarrywu.com/zh/',
    meta: '了解 Tutti',
  },
] satisfies RelatedLink[];

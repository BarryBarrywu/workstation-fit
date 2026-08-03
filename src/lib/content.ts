export type EpisodeDestination = {
  label: string;
  url: string | null;
};

export const relatedEpisode = {
  title: '从建议数值，到真实工位。',
  summary: '相关视频会演示怎样把这些建议用到桌子、椅子和显示器上。发布后，可以从下面的平台观看。',
  cover: null as string | null,
  coverAlt: '相关视频封面',
  destinations: [
    { label: 'B站', url: null },
    { label: 'YouTube', url: null },
    { label: '微信公众号', url: null },
    { label: '抖音', url: null },
  ] satisfies EpisodeDestination[],
};

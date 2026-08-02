export type EpisodeDestination = {
  label: string;
  url: string | null;
};

export const relatedEpisode = {
  title: '从数字，到一套真实工位。',
  summary: '相关视频会讲解如何把起始范围落实到桌子、椅子与显示器。发布后可从下面的平台继续观看。',
  cover: null as string | null,
  coverAlt: '相关视频封面',
  destinations: [
    { label: 'B站', url: null },
    { label: 'YouTube', url: null },
    { label: '微信公众号', url: null },
    { label: '抖音', url: null },
  ] satisfies EpisodeDestination[],
};

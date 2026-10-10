// Original QCU line drawings, MIT. Generic learning symbols; not a school crest.
export const iconPaths = {
  market: ['M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4z', 'M12 6v15'],
  lesson: ['M4 4h16v12H4z', 'M8 21l4-5 4 5M8 8h8M8 12h5'],
  slides: ['M4 3h16v14H4z', 'M12 17v4M8 21h8M8 7h8M8 11h5'],
  document: ['M6 3h8l4 4v14H6z', 'M14 3v5h4M9 12h6M9 16h6'],
  data: ['M4 4h16v16H4z', 'M4 10h16M10 4v16M14 14h3M14 17h3'],
  reading: ['M3 5h7l2 2 2-2h7v14h-7l-2 2-2-2H3z', 'M12 7v14M6 9h3M6 13h3M15 9h3M15 13h3'],
  integrity: ['M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z', 'M8 12l3 3 5-6'],
}
export function sceneIcon(category) {
  return ({'备课与课堂活动':'lesson','课件制作':'slides','教学文档':'document','匿名教学数据':'data','阅读笔记与复习':'reading','学术诚信与引用':'integrity'})[category] ?? 'market'
}

/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
export const TOPICS = [
  'Array', 'String', 'Hash Table', 'Linked List', 'Stack', 'Queue', 'Heap',
  'Tree', 'BST', 'Trie', 'Graph', 'DFS', 'BFS', 'Union Find', 'Binary Search',
  'Sliding Window', 'Two Pointers', 'Prefix Sum', 'Greedy', 'Dynamic Programming',
  'Backtracking', 'Recursion', 'Bit Manipulation', 'Math', 'Geometry', 'SQL',
  'Database', 'Simulation', 'Design'
];

export function normalizeTopic(tag: string): string {
  const lowerTag = tag.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  if (lowerTag.includes('array') || lowerTag.includes('list')) return 'Array';
  if (lowerTag.includes('string')) return 'String';
  if (lowerTag.includes('hash') || lowerTag.includes('map') || lowerTag.includes('dict')) return 'Hash Table';
  if (lowerTag.includes('linked list')) return 'Linked List';
  if (lowerTag.includes('stack')) return 'Stack';
  if (lowerTag.includes('queue')) return 'Queue';
  if (lowerTag.includes('heap') || lowerTag.includes('priority')) return 'Heap';
  if (lowerTag.includes('bst') || lowerTag.includes('binary search tree')) return 'BST';
  if (lowerTag.includes('tree')) return 'Tree';
  if (lowerTag.includes('trie')) return 'Trie';
  if (lowerTag.includes('graph') || lowerTag.includes('matrix')) return 'Graph';
  if (lowerTag.includes('dfs') || lowerTag.includes('depth')) return 'DFS';
  if (lowerTag.includes('bfs') || lowerTag.includes('breadth')) return 'BFS';
  if (lowerTag.includes('union') || lowerTag.includes('disjoint')) return 'Union Find';
  if (lowerTag.includes('binary search')) return 'Binary Search';
  if (lowerTag.includes('sliding') || lowerTag.includes('window')) return 'Sliding Window';
  if (lowerTag.includes('two pointer')) return 'Two Pointers';
  if (lowerTag.includes('prefix')) return 'Prefix Sum';
  if (lowerTag.includes('greedy')) return 'Greedy';
  if (lowerTag.includes('dp') || lowerTag.includes('dynamic program')) return 'Dynamic Programming';
  if (lowerTag.includes('backtrack')) return 'Backtracking';
  if (lowerTag.includes('recurs')) return 'Recursion';
  if (lowerTag.includes('bit')) return 'Bit Manipulation';
  if (lowerTag.includes('math') || lowerTag.includes('number')) return 'Math';
  if (lowerTag.includes('geo')) return 'Geometry';
  if (lowerTag.includes('sql') || lowerTag.includes('query')) return 'SQL';
  if (lowerTag.includes('db') || lowerTag.includes('database')) return 'Database';
  if (lowerTag.includes('simul')) return 'Simulation';
  if (lowerTag.includes('design') || lowerTag.includes('system') || lowerTag.includes('oop')) return 'Design';
  
  return 'Uncategorized';
}

export function extractTopics(tags: string[]): { primaryTopic: string; topics: string[] } {
  const normalizedTopics = new Set<string>();
  
  for (const tag of tags) {
    const norm = normalizeTopic(tag);
    if (norm !== 'Uncategorized') {
      normalizedTopics.add(norm);
    }
  }

  const topicsArray = Array.from(normalizedTopics);
  return {
    primaryTopic: topicsArray.length > 0 ? topicsArray[0] : 'Uncategorized',
    topics: topicsArray.length > 0 ? topicsArray : ['Uncategorized']
  };
}

/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */

/**
 * Resolves a programming language name (e.g. "Python 3", "C++14") to its standard file extension (e.g. "py", "cpp").
 * This mapping is shared across all platforms to ensure consistent behavior.
 */
export function resolveLanguageExtension(language: string, code = ''): string {
  if (!language) {
    return detectLanguageFromCode(code) || 'txt';
  }

  const normalized = language.toLowerCase().replace(/\s+/g, ' ').trim();

  const languageToExtension: Record<string, string> = {
    // Python variants
    'python': 'py',
    'python 3': 'py',
    'python3': 'py',
    'python 3.x': 'py',
    'python 3.8': 'py',
    'python 3.10': 'py',
    'python 3.11': 'py',
    'python 3.12': 'py',
    'py': 'py',
    'pypy': 'py',
    'pypy3': 'py',
    'pypy 3': 'py',
    
    // JavaScript variants
    'javascript': 'js',
    'javascript (node.js)': 'js',
    'javascript (node)': 'js',
    'node.js': 'js',
    'node': 'js',
    'js': 'js',
    
    // TypeScript variants
    'typescript': 'ts',
    'typescript (node.js)': 'ts',
    'ts': 'ts',
    
    // Java variants
    'java': 'java',
    'java 8': 'java',
    'java 11': 'java',
    'java 14': 'java',
    'java 15': 'java',
    'java 17': 'java',
    'java 21': 'java',
    'java 22': 'java',
    
    // C# variants
    'c#': 'cs',
    'c sharp': 'cs',
    'csharp': 'cs',
    'cs': 'cs',
    'mono c#': 'cs',
    
    // C++ variants
    'c++': 'cpp',
    'cpp': 'cpp',
    'c plus plus': 'cpp',
    'c++14': 'cpp',
    'c++17': 'cpp',
    'c++20': 'cpp',
    'gnu c++': 'cpp',
    'gnu c++14': 'cpp',
    'gnu c++17': 'cpp',
    'gnu c++20': 'cpp',
    'c++ (gcc)': 'cpp',
    
    // C variants
    'c': 'c',
    'c language': 'c',
    'gnu c': 'c',
    'c (gcc)': 'c',
    
    // Go
    'go': 'go',
    'golang': 'go',
    
    // Rust
    'rust': 'rs',
    
    // Kotlin
    'kotlin': 'kt',
    
    // Swift
    'swift': 'swift',
    
    // PHP
    'php': 'php',
    
    // Ruby
    'ruby': 'rb',
    
    // Scala
    'scala': 'scala',
    
    // Dart
    'dart': 'dart',
    
    // Perl
    'perl': 'pl',
    
    // Bash / Shell
    'bash': 'sh',
    'shell': 'sh',
    
    // R
    'r': 'r',
    
    // Erlang
    'erlang': 'erl',
    
    // Elixir
    'elixir': 'ex',
    
    // Haskell
    'haskell': 'hs',
    
    // Lua
    'lua': 'lua',
    
    // Objective-C
    'objective-c': 'm',
    'objective c': 'm',
    
    // SQL
    'mysql': 'sql',
    'sqlite': 'sql',
    'ms sql server': 'sql',
    'oracle': 'sql',
    'sql': 'sql',
  };

  if (languageToExtension[normalized]) {
    return languageToExtension[normalized];
  }

  // Substring matching for edge cases (e.g. "Python 3.8.1")
  if (normalized.includes('python') || normalized.includes('pypy')) return 'py';
  if (normalized.includes('javascript') || normalized.includes('node.js') || normalized.includes('node')) return 'js';
  if (normalized.includes('typescript')) return 'ts';
  if (normalized.includes('java') && !normalized.includes('javascript')) return 'java';
  if (normalized.includes('c#') || normalized.includes('csharp') || normalized.includes('c sharp')) return 'cs';
  if (normalized.includes('c++') || normalized.includes('cpp') || normalized.includes('c plus plus')) return 'cpp';
  if (normalized === 'c' || (normalized.includes('c') && normalized.includes('gcc'))) return 'c';
  if (normalized.includes('go') || normalized.includes('golang')) return 'go';
  if (normalized.includes('rust')) return 'rs';
  if (normalized.includes('kotlin')) return 'kt';
  if (normalized.includes('swift')) return 'swift';
  if (normalized.includes('php')) return 'php';
  if (normalized.includes('ruby')) return 'rb';
  if (normalized.includes('scala')) return 'scala';
  if (normalized.includes('dart')) return 'dart';

  // Fallback to code heuristic
  return detectLanguageFromCode(code) || 'txt';
}

function detectLanguageFromCode(code: string): string | null {
  const codeNormalized = code.trim();
  if (!codeNormalized) return null;

  if (looksLikePython(codeNormalized)) return 'py';
  if (looksLikeJava(codeNormalized)) return 'java';
  if (looksLikeJavaScript(codeNormalized)) return 'js';
  if (looksLikeTypeScript(codeNormalized)) return 'ts';
  if (looksLikeCpp(codeNormalized)) return 'cpp';
  if (looksLikeCSharp(codeNormalized)) return 'cs';
  if (looksLikeGo(codeNormalized)) return 'go';

  return null;
}

function looksLikePython(code: string): boolean {
  return /(^|\n)\s*def\s+\w+\s*\(/.test(code) || /(^|\n)\s*class\s+\w+\s*:/.test(code) || /(^|\n)\s*if\s+__name__\s*==\s*['"]__main__['"]\s*:/.test(code);
}

function looksLikeJava(code: string): boolean {
  return /\bpublic\s+class\s+\w+/.test(code) || /\bimport\s+java\./.test(code) || /\bSystem\.out\.print/.test(code);
}

function looksLikeJavaScript(code: string): boolean {
  return /\bfunction\s+\w+\s*\(/.test(code) || /\bconst\s+\w+\s*=/.test(code) || /\blet\s+\w+\s*=/.test(code) || /=>/.test(code);
}

function looksLikeTypeScript(code: string): boolean {
  return /:\s*(string|number|boolean|any|unknown)\b/.test(code) || /\binterface\s+\w+/.test(code) || /\btype\s+\w+\s*=/.test(code);
}

function looksLikeCpp(code: string): boolean {
  return /#include\s*<.*>/.test(code) || /\bstd::/.test(code) || /\busing\s+namespace\s+std\b/.test(code);
}

function looksLikeCSharp(code: string): boolean {
  return /\busing\s+System\b/.test(code) || /\bnamespace\s+\w+/.test(code) || /\bConsole\.Write(Line)?\b/.test(code);
}

function looksLikeGo(code: string): boolean {
  return /\bpackage\s+main\b/.test(code) || /\bfunc\s+\w+\s*\(/.test(code) || /\bfmt\./.test(code);
}

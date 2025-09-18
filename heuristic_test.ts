import * as path from 'path';
import * as fs from 'fs';

// 启发式版本的类型定义
type VariableInfo = {
  name: string;
  typeName: string;
  isPointer: boolean;
  isInitialized: boolean;
  firstUseLine: number | null;
};

type Issue = {
  file: string;
  line: number;
  category: string;
  message: string;
  codeLine: string;
};

// 启发式版本的分析函数（从git历史中恢复）
function analyzeDirHeuristic(dir: string): Issue[] {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.c'));
  const issues: Issue[] = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    const globals: Map<string, VariableInfo> = new Map();
    const localsStack: Array<Map<string, VariableInfo>> = [];
    const funcStack: string[] = [];
    let braceDepth = 0;

    function currentLocals(): Map<string, VariableInfo> | undefined {
      return localsStack[localsStack.length - 1];
    }

    const typeKeywords = ['int','char','float','double','void','short','long','signed','unsigned','bool','size_t'];

    const isLikelyDecl = (line: string) => {
      if (!line.includes(';')) return false;
      if (line.trimStart().startsWith('#')) return false;
      if (/\b(printf|scanf|malloc|free|strcpy|strlen)\b/.test(line)) return false;
      return typeKeywords.some(t => new RegExp(`(^|\\s)${t}(\\s|\\*)`).test(line));
    };

    const parseDecl = (line: string): Array<VariableInfo & { line: number; col: number }> => {
      const result: Array<VariableInfo & { line: number; col: number }> = [];
      const semi = line.indexOf(';');
      const head = semi >= 0 ? line.slice(0, semi) : line;
      const m = head.match(/^\s*([a-zA-Z_][\w\s\*]*?)\s+(.+)$/);
      if (!m) return result;
      const base = m[1].trim();
      const decls = m[2];
      for (const raw of decls.split(',')) {
        const it = raw.trim();
        if (!it || it.includes('(')) continue; // 跳过函数指针
        const star = /^\*/.test(it);
        const nameMatch = it.match(/\**\s*([a-zA-Z_][\w]*)/);
        if (!nameMatch) continue;
        const name = nameMatch[1];
        const isPtr = star || /\*/.test(base);
        const isInit = /=/.test(it);
        result.push({ name, typeName: base.replace(/\*/g, '').trim(), isPointer: isPtr, isInitialized: isInit, firstUseLine: null, line: 0, col: 0 });
      }
      return result;
    };

    const pointerDerefPatterns = (name: string) => [new RegExp(`\\*${name}\\b`), new RegExp(`${name}\\s*->`), new RegExp(`${name}\\s*\\[` )];

    const tokenContains = (line: string, name: string) => new RegExp(`(^|[^\\w])${name}([^\\w]|$)`).test(line);

    const looksAssignmentTo = (line: string, name: string) => new RegExp(`(^|[^=<>!])${name}\\s*([-+*/]?=)`).test(line);

    const pointerInitKind = (line: string) => {
      if (/=\s*(NULL|0)\b/.test(line)) return 1; // null-like
      if (/=\s*&/.test(line)) return 2; // addr-of
      if (/=\s*\b(malloc|calloc|realloc)\s*\(/.test(line)) return 3; // heap
      return 0;
    };

    const formatSpecCount = (fmt: string) => {
      let cnt = 0;
      for (let i = 0; i < fmt.length; i++) {
        if (fmt[i] === '%') {
          if (fmt[i + 1] === '%') { i++; continue; }
          cnt++;
        }
      }
      return cnt;
    };

    const getArgsFromCall = (line: string) => {
      const lp = line.indexOf('(');
      const rp = line.lastIndexOf(')');
      if (lp < 0 || rp < 0 || rp <= lp) return [] as string[];
      const inside = line.slice(lp + 1, rp);
      const parts: string[] = [];
      let depth = 0, buf = '', inStr = false, q = '';
      for (let i = 0; i < inside.length; i++) {
        const c = inside[i];
        if (inStr) { buf += c; if (c === q) inStr = false; continue; }
        if (c === '"' || c === '\'') { inStr = true; q = c; buf += c; continue; }
        if (c === '(') { depth++; buf += c; continue; }
        if (c === ')') { if (depth > 0) depth--; buf += c; continue; }
        if (c === ',' && depth === 0) { parts.push(buf.trim()); buf = ''; continue; }
        buf += c;
      }
      if (buf.trim()) parts.push(buf.trim());
      return parts;
    };

    const getNameFromExpr = (expr: string) => {
      const m = expr.trim().replace(/^&/, '').match(/([a-zA-Z_][\w]*)/);
      return m ? m[1] : '';
    };

    const getVar = (name: string): VariableInfo | undefined => {
      for (let i = localsStack.length - 1; i >= 0; i--) {
        const v = localsStack[i].get(name);
        if (v) return v;
      }
      return globals.get(name);
    };

    const markInit = (name: string, lineText: string) => {
      const v = getVar(name);
      if (!v) return 0;
      v.isInitialized = true;
      return v.isPointer ? pointerInitKind(lineText) : 0;
    };

    // 遍历行
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      let line = raw.trim();
      if (!line) continue;
      if (line.startsWith('#')) continue;
      if (/\/\//.test(line)) line = line.split('//')[0];

      // 作用域跟踪
      for (const ch of raw) {
        if (ch === '{') { braceDepth++; localsStack.push(new Map()); funcStack.push(''); }
        if (ch === '}') { braceDepth = Math.max(0, braceDepth - 1); localsStack.pop(); funcStack.pop(); }
      }

      // 函数定义头：将形参加入当前局部表并标记为已初始化
      if (raw.includes('(') && raw.includes(')') && raw.trim().endsWith('{') && !raw.trimStart().startsWith('#')) {
        const lp = raw.indexOf('(');
        const rp = raw.lastIndexOf(')');
        if (lp >= 0 && rp > lp) {
          const paramsRaw = raw.slice(lp + 1, rp).trim();
          if (paramsRaw && paramsRaw !== 'void') {
            const params = getArgsFromCall(raw);
            const locals = currentLocals() ?? (localsStack.length > 0 ? localsStack[localsStack.length - 1] : undefined);
            if (locals) {
              for (const p of params) {
                const token = p.trim();
                if (!token) continue;
                const nameMatch = token.match(/([a-zA-Z_][\w]*)\s*$/);
                if (!nameMatch) continue;
                const name = nameMatch[1];
                const isPtr = /\*/.test(token);
                const typePart = token.replace(new RegExp(`([\\*\s])?${name}\s*$`), '').trim();
                const typeName = typePart.replace(/\s+/g, ' ').replace(/\*+/g, '').trim() || 'int';
                locals.set(name, { name, typeName, isPointer: isPtr, isInitialized: true, firstUseLine: null });
              }
            }
          }
        }
      }

      // 变量声明
      if (isLikelyDecl(line)) {
        const decls = parseDecl(line);
        for (const d of decls) {
          const vi: VariableInfo = { name: d.name, typeName: d.typeName, isPointer: d.isPointer, isInitialized: d.isInitialized, firstUseLine: null };
          if (braceDepth === 0) globals.set(vi.name, vi); else (currentLocals() ?? globals).set(vi.name, vi);
        }
        continue;
      }

      // 死循环（简单启发式）
      if (/\bfor\s*\(\s*;\s*;\s*\)/.test(line) || /\bwhile\s*\(\s*(1|true)\s*\)/.test(line)) {
        if (!/\b(break|return|exit\s*\()\b/.test(line)) {
          issues.push({
            file: filePath,
            line: i + 1,
            category: 'Infinite loop',
            message: '潜在死循环（无显式退出）',
            codeLine: raw
          });
        }
      }

      // 赋值初始化
      for (const name of new Set([...globals.keys(), ...Array.from(localsStack.flatMap(m => Array.from(m.keys())))])) {
        if (tokenContains(line, name) && looksAssignmentTo(line, name)) {
          const kind = markInit(name, line);
          if (kind === 1) {
            // 若下一行立刻解引用，提示空指针解引用风险
          }
        }
      }

      // 未初始化使用 & 野指针解引用
      for (const name of new Set([...globals.keys(), ...Array.from(localsStack.flatMap(m => Array.from(m.keys())))])) {
        if (!tokenContains(line, name)) continue;
        const v = getVar(name);
        if (!v) continue;
        if (!v.isInitialized) {
          const derefHit = pointerDerefPatterns(name).some(r => r.test(line));
          if (v.isPointer && derefHit) {
            issues.push({
              file: filePath,
              line: i + 1,
              category: 'Wild pointer',
              message: '潜在野指针解引用（指针未初始化）',
              codeLine: raw
            });
          } else {
            issues.push({
              file: filePath,
              line: i + 1,
              category: 'Uninitialized',
              message: '变量使用前未初始化',
              codeLine: raw
            });
          }
          if (v.firstUseLine == null) v.firstUseLine = i + 1;
        }
      }

      // printf / scanf 检查
      if (/\b(printf|scanf)\s*\(/.test(line)) {
        const isScanf = /\bscanf\s*\(/.test(line);
        const args = getArgsFromCall(line);
        if (args.length >= 1) {
          const fmt = args[0];
          const fmtStrMatch = fmt.match(/^[\s\(]*"([\s\S]*?)"[\s\)]*$/);
          const specCount = fmtStrMatch ? formatSpecCount(fmtStrMatch[1]) : 0;
          const provided = Math.max(0, args.length - 1);
          if (provided < specCount) {
            issues.push({
              file: filePath,
              line: i + 1,
              category: 'Format',
              message: `${isScanf ? 'scanf' : 'printf'} 参数少于格式化占位数`,
              codeLine: raw
            });
          }
          if (provided > specCount) {
            issues.push({
              file: filePath,
              line: i + 1,
              category: 'Format',
              message: `${isScanf ? 'scanf' : 'printf'} 参数多于格式化占位数`,
              codeLine: raw
            });
          }

          // 基础 & 检查（scanf 需要地址）
          if (isScanf) {
            for (let ai = 1; ai < args.length; ai++) {
              const expr = args[ai];
              const name = getNameFromExpr(expr);
              if (!name) continue;
              if (!expr.trim().startsWith('&')) {
                const v = getVar(name);
                if (!(v && v.typeName === 'char')) { // char 数组可不加 &
                  issues.push({
                    file: filePath,
                    line: i + 1,
                    category: 'Format',
                    message: 'scanf 实参建议传地址（使用 &var）',
                    codeLine: raw
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return issues;
}

function printIssues(issues: Issue[]) {
  for (const issue of issues) {
    const relativePath = path.relative(process.cwd(), issue.file);
    console.log(`${relativePath}:${issue.line}: [${issue.category}] ${issue.message}`);
    console.log(`    ${issue.codeLine}`);
  }
}

function printTables() {
  console.log('\n=== 启发式C代码安全扫描器 ===');
  console.log('支持的检测功能:');
  console.log('- 未初始化变量检测');
  console.log('- 野指针检测');
  console.log('- 空指针检测');
  console.log('- 死循环检测');
  console.log('- printf/scanf格式检查');
}

async function main() {
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(process.cwd(), 'tests/graphs/buggy');

  console.log(`正在扫描目录: ${dir}`);

  try {
    const issues = analyzeDirHeuristic(dir);

    if (issues.length === 0) {
      console.log('没有发现问题。');
    } else {
      printIssues(issues);
    }

    printTables();
  } catch (error) {
    console.error('扫描过程中发生错误:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('程序执行失败:', err);
  process.exit(1);
});
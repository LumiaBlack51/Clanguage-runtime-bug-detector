import { CASTParser, VariableDeclaration, ASTNode } from '../core/ast_parser';

/**
 * 独立的AST变量检测器（不依赖VSCode API）
 * 检测未初始化变量使用和野指针解引用
 */
export class StandaloneASTVariableDetector {
  private parser: CASTParser;

  constructor() {
    this.parser = new CASTParser();
  }

  /**
   * 分析文件并返回问题列表
   */
  async analyzeFile(filePath: string, sourceCode: string): Promise<any[]> {
    const sourceLines = sourceCode.split(/\r?\n/);

    const issues: any[] = [];

    try {
      const ast = this.parser.parse(sourceCode);

      // 提取所有变量声明
      const declarations = this.parser.extractVariableDeclarations(ast, sourceLines);

      // 创建变量映射，按作用域分组
      const variablesByScope = this.groupVariablesByScope(declarations);

      // 检查每个变量的使用
      for (const [scope, variables] of variablesByScope) {
        for (const variable of variables) {
          const variableIssues = this.checkVariableUsage(ast, variable, sourceLines, filePath);
          issues.push(...variableIssues);
        }
      }

      // 检查空指针解引用
      const nullPointerIssues = this.checkNullPointerDereference(ast, sourceLines, filePath);
      issues.push(...nullPointerIssues);

    } catch (error) {
      console.error('AST parsing error:', error);
      // 如果 AST 解析失败，返回空问题列表而不是崩溃
    }

    return issues;
  }

  /**
   * 按作用域分组变量
   */
  private groupVariablesByScope(declarations: VariableDeclaration[]): Map<string, VariableDeclaration[]> {
    const grouped = new Map<string, VariableDeclaration[]>();

    for (const decl of declarations) {
      const scope = decl.scope;
      if (!grouped.has(scope)) {
        grouped.set(scope, []);
      }
      grouped.get(scope)!.push(decl);
    }

    return grouped;
  }

  /**
   * 检查单个变量的使用情况
   */
  private checkVariableUsage(ast: ASTNode, variable: VariableDeclaration, sourceLines: string[], filePath: string): any[] {
    const issues: any[] = [];

    // 如果变量已初始化或是参数，跳过检查
    if (variable.isInitialized || variable.isParameter) {
      return issues;
    }

    // 过滤掉结构体字段的误报
    if (this.isStructField(sourceLines, variable.position.row)) {
      return issues;
    }

    // 查找变量的所有使用位置
    const usages = this.parser.findVariableUsages(ast, variable.name);

    // 查找指针解引用
    const dereferences = this.parser.findPointerDereferences(ast, variable.name);

    // 检查每个使用位置
    for (const usage of usages) {
      // 跳过声明位置
      if (usage.row === variable.position.row) {
        continue;
      }

      // 检查是否是赋值操作（这会初始化变量）
      if (this.isAssignmentTarget(sourceLines[usage.row], variable.name, usage.column)) {
        // 标记变量为已初始化（简化处理）
        variable.isInitialized = true;
        continue;
      }

      // 报告未初始化使用
      issues.push({
        file: filePath,
        line: usage.row + 1,
        column: usage.column,
        category: 'Uninitialized',
        message: `变量 '${variable.name}' 在初始化前被使用`,
        severity: 1, // Warning
        codeLine: sourceLines[usage.row] || ''
      });
    }

    // 检查指针解引用
    for (const deref of dereferences) {
      // 跳过声明位置
      if (deref.row === variable.position.row) {
        continue;
      }

      if (variable.isPointer && !variable.isInitialized) {
        issues.push({
          file: filePath,
          line: deref.row + 1,
          column: deref.column,
          category: 'NullPointer',
          message: `潜在野指针解引用：指针 '${variable.name}' 未初始化`,
          severity: 0, // Error
          codeLine: sourceLines[deref.row] || ''
        });
      }
    }

    return issues;
  }

  /**
   * 检查是否是赋值目标
   */
  private isAssignmentTarget(line: string, variableName: string, column: number): boolean {
    const trimmedLine = line.trim();

    // 查找变量名在行中的位置
    const varIndex = line.indexOf(variableName, column);
    if (varIndex === -1) {
      return false;
    }

    // 检查变量后面是否紧跟赋值操作符
    const afterVar = line.slice(varIndex + variableName.length).trim();
    return /^(=|[\+\-\*\/\%]?=)/.test(afterVar);
  }

  /**
   * 检查空指针解引用
   */
  checkNullPointerDereference(ast: ASTNode, sourceLines: string[], filePath: string): any[] {
    const issues: any[] = [];
    const declarations = this.parser.extractVariableDeclarations(ast, sourceLines);

    // 查找被赋值为 NULL 或 0 的指针
    const nullPointers = declarations.filter(decl =>
      decl.isPointer && this.isNullInitialized(sourceLines[decl.position.row])
    );

    for (const pointer of nullPointers) {
      const dereferences = this.parser.findPointerDereferences(ast, pointer.name);

      for (const deref of dereferences) {
        // 检查解引用是否在 NULL 赋值之后
        if (deref.row > pointer.position.row) {
          issues.push({
            file: filePath,
            line: deref.row + 1,
            column: deref.column,
            category: 'NullPointer',
            message: `潜在空指针解引用：指针 '${pointer.name}' 可能为 NULL`,
            severity: 0, // Error
            codeLine: sourceLines[deref.row] || ''
          });
        }
      }
    }

    return issues;
  }

  /**
   * 检查是否是结构体字段
   */
  private isStructField(sourceLines: string[], lineNumber: number): boolean {
    // 检查前几行是否有结构体定义
    for (let i = Math.max(0, lineNumber - 5); i < lineNumber; i++) {
      const line = sourceLines[i].trim();
      if (line.includes('typedef struct') || line.includes('struct ')) {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查是否初始化为 NULL
   */
  private isNullInitialized(line: string): boolean {
    return /=\s*(NULL|0)\b/.test(line);
  }
}
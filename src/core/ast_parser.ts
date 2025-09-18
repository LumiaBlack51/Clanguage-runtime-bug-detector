import Parser = require('tree-sitter');
const C = require('tree-sitter-c');

export interface ASTNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: ASTNode[];
  namedChildren: ASTNode[];
  parent?: ASTNode;
  fieldName?: string;
}

export interface VariableDeclaration {
  name: string;
  type: string;
  isPointer: boolean;
  isArray: boolean;
  isInitialized: boolean;
  isParameter: boolean;
  isGlobal: boolean;
  position: { row: number; column: number };
  scope: string; // function name or 'global'
}

export interface FunctionCall {
  name: string;
  arguments: string[];
  position: { row: number; column: number };
}

export interface IncludeDirective {
  headerName: string;
  isSystemHeader: boolean; // <> vs ""
  position: { row: number; column: number };
}

export class CASTParser {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(C as any);
  }

  /**
   * 解析 C 代码并返回 AST 根节点
   */
  parse(sourceCode: string): ASTNode {
    const tree = this.parser.parse(sourceCode);
    return this.convertNode(tree.rootNode);
  }

  /**
   * 转换 tree-sitter 节点为我们的 ASTNode 接口
   */
  private convertNode(node: Parser.SyntaxNode, parent?: ASTNode): ASTNode {
    const astNode: ASTNode = {
      type: node.type,
      text: node.text,
      startPosition: node.startPosition,
      endPosition: node.endPosition,
      children: [],
      namedChildren: [],
      parent,
    };

    // 转换子节点
    for (const child of node.children) {
      const childNode = this.convertNode(child, astNode);
      astNode.children.push(childNode);
    }

    // 转换命名子节点
    for (const namedChild of node.namedChildren) {
      const childNode = this.convertNode(namedChild, astNode);
      astNode.namedChildren.push(childNode);
    }

    return astNode;
  }

  /**
   * 提取所有变量声明
   */
  extractVariableDeclarations(root: ASTNode, sourceLines: string[]): VariableDeclaration[] {
    const declarations: VariableDeclaration[] = [];
    const currentScope = this.getCurrentScope(root);

    this.traverseNode(root, (node) => {
      if (node.type === 'declaration') {
        // 检查是否在结构体定义内部（通过源代码分析）
        const lineNumber = node.startPosition.row;
        if (this.isInStructDefinition(sourceLines, lineNumber)) {
          // 跳过结构体字段声明
          return;
        }
        const vars = this.parseDeclaration(node, currentScope, sourceLines);
        declarations.push(...vars);
      } else if (node.type === 'parameter_declaration') {
        const vars = this.parseParameterDeclaration(node, currentScope);
        declarations.push(...vars);
      }
    });

    return declarations;
  }

  /**
   * 提取所有函数调用
   */
  extractFunctionCalls(root: ASTNode): FunctionCall[] {
    const calls: FunctionCall[] = [];

    this.traverseNode(root, (node) => {
      if (node.type === 'call_expression') {
        const call = this.parseCallExpression(node);
        if (call) {
          calls.push(call);
        }
      }
    });

    return calls;
  }

  /**
   * 提取所有 include 指令
   */
  extractIncludeDirectives(root: ASTNode): IncludeDirective[] {
    const includes: IncludeDirective[] = [];

    this.traverseNode(root, (node) => {
      if (node.type === 'preproc_include') {
        const include = this.parseIncludeDirective(node);
        if (include) {
          includes.push(include);
        }
      }
    });

    return includes;
  }

  /**
   * 查找变量使用位置
   */
  findVariableUsages(root: ASTNode, variableName: string): { row: number; column: number }[] {
    const usages: { row: number; column: number }[] = [];

    this.traverseNode(root, (node) => {
      if (node.type === 'identifier' && node.text === variableName) {
        // 确保这是一个变量引用而不是声明
        if (!this.isDeclaration(node)) {
          usages.push(node.startPosition);
        }
      }
    });

    return usages;
  }

  /**
   * 查找指针解引用操作
   */
  findPointerDereferences(root: ASTNode, variableName: string): { row: number; column: number }[] {
    const dereferences: { row: number; column: number }[] = [];

    this.traverseNode(root, (node) => {
      // 查找 *variable
      if (node.type === 'pointer_expression') {
        const argument = node.namedChildren[0];
        if (argument && argument.type === 'identifier' && argument.text === variableName) {
          dereferences.push(node.startPosition);
        }
      }
      // 查找 variable->field
      else if (node.type === 'field_expression' && node.text.includes('->')) {
        const argument = node.namedChildren[0];
        if (argument && argument.type === 'identifier' && argument.text === variableName) {
          dereferences.push(node.startPosition);
        }
      }
      // 查找 variable[index]
      else if (node.type === 'subscript_expression') {
        const argument = node.namedChildren[0];
        if (argument && argument.type === 'identifier' && argument.text === variableName) {
          dereferences.push(node.startPosition);
        }
      }
    });

    return dereferences;
  }

  /**
   * 查找循环语句
   */
  findLoops(root: ASTNode): ASTNode[] {
    const loops: ASTNode[] = [];

    this.traverseNode(root, (node) => {
      if (node.type === 'for_statement' || node.type === 'while_statement' || node.type === 'do_statement') {
        loops.push(node);
      }
    });

    return loops;
  }

  /**
   * 检查循环是否可能是死循环
   */
  isInfiniteLoop(loopNode: ASTNode): boolean {
    // 检查 for(;;) 或 while(1) 等明显的死循环
    if (loopNode.type === 'for_statement') {
      const condition = this.findChildByType(loopNode, 'binary_expression');
      if (!condition) {
        // for(;;) 形式
        return !this.hasBreakOrReturn(loopNode);
      }
    } else if (loopNode.type === 'while_statement') {
      const condition = loopNode.namedChildren[0];
      if (condition && (condition.text === '1' || condition.text === 'true')) {
        return !this.hasBreakOrReturn(loopNode);
      }
    }

    return false;
  }

  /**
   * 检查节点内是否有 break 或 return 语句
   */
  private hasBreakOrReturn(node: ASTNode): boolean {
    let hasExit = false;

    this.traverseNode(node, (child) => {
      if (child.type === 'break_statement' || child.type === 'return_statement') {
        hasExit = true;
      }
      // 检查 exit() 函数调用
      if (child.type === 'call_expression') {
        const funcName = child.namedChildren[0];
        if (funcName && funcName.text === 'exit') {
          hasExit = true;
        }
      }
    });

    return hasExit;
  }

  /**
   * 遍历 AST 节点
   */
  private traverseNode(node: ASTNode, callback: (node: ASTNode) => void): void {
    callback(node);
    for (const child of node.namedChildren) {
      this.traverseNode(child, callback);
    }
  }

  /**
   * 解析变量声明
   */
  private parseDeclaration(node: ASTNode, scope: string, sourceLines: string[]): VariableDeclaration[] {
    const declarations: VariableDeclaration[] = [];
    
    // 查找类型说明符
    const typeSpecifier = this.findChildByType(node, 'primitive_type') || 
                         this.findChildByType(node, 'type_identifier') ||
                         this.findChildByType(node, 'struct_specifier');
    
    if (!typeSpecifier) return declarations;

    const baseType = typeSpecifier.text;

    // 查找声明器
    const declarators = this.findChildrenByType(node, 'init_declarator') ||
                       this.findChildrenByType(node, 'declarator');

    for (const declarator of declarators) {
      const varInfo = this.parseDeclarator(declarator, baseType, scope, sourceLines);
      if (varInfo) {
        declarations.push(varInfo);
      }
    }

    return declarations;
  }

  /**
   * 解析声明器（变量名、指针等）
   */
  private parseDeclarator(declarator: ASTNode, baseType: string, scope: string, sourceLines: string[]): VariableDeclaration | null {
    let name = '';
    let isPointer = false;
    let isArray = false;
    let isInitialized = false;

    // 检查是否有初始化器
    const initDeclarator = this.findChildByType(declarator, 'init_declarator');
    if (initDeclarator) {
      isInitialized = true;
      const actualDeclarator = this.findChildByType(initDeclarator, 'declarator') ||
                              this.findChildByType(initDeclarator, 'pointer_declarator') ||
                              this.findChildByType(initDeclarator, 'array_declarator');
      if (actualDeclarator) {
        declarator = actualDeclarator;
      }
    } else {
      // 检查当前行是否有 = 号
      const line = sourceLines[declarator.startPosition.row];
      isInitialized = !!(line && line.includes('='));
    }

    // 解析声明器类型
    if (declarator.type === 'pointer_declarator') {
      isPointer = true;
      const innerDeclarator = this.findChildByType(declarator, 'identifier') ||
                             this.findChildByType(declarator, 'declarator');
      if (innerDeclarator) {
        name = innerDeclarator.text;
      }
    } else if (declarator.type === 'array_declarator') {
      isArray = true;
      const innerDeclarator = this.findChildByType(declarator, 'identifier') ||
                             this.findChildByType(declarator, 'declarator');
      if (innerDeclarator) {
        name = innerDeclarator.text;
      }
    } else if (declarator.type === 'identifier') {
      name = declarator.text;
    } else {
      // 查找标识符
      const identifier = this.findChildByType(declarator, 'identifier');
      if (identifier) {
        name = identifier.text;
      }
    }

    if (!name) return null;

    return {
      name,
      type: baseType,
      isPointer,
      isArray,
      isInitialized,
      isParameter: false,
      isGlobal: scope === 'global',
      position: declarator.startPosition,
      scope
    };
  }

  /**
   * 解析参数声明
   */
  private parseParameterDeclaration(node: ASTNode, scope: string): VariableDeclaration[] {
    const declarations: VariableDeclaration[] = [];
    
    const typeSpecifier = this.findChildByType(node, 'primitive_type') || 
                         this.findChildByType(node, 'type_identifier');
    
    if (!typeSpecifier) return declarations;

    const baseType = typeSpecifier.text;
    const declarator = this.findChildByType(node, 'declarator') ||
                      this.findChildByType(node, 'pointer_declarator') ||
                      this.findChildByType(node, 'array_declarator');

    if (declarator) {
      const varInfo = this.parseDeclarator(declarator, baseType, scope, []);
      if (varInfo) {
        varInfo.isParameter = true;
        varInfo.isInitialized = true; // 参数默认已初始化
        declarations.push(varInfo);
      }
    }

    return declarations;
  }

  /**
   * 解析函数调用表达式
   */
  private parseCallExpression(node: ASTNode): FunctionCall | null {
    const funcIdentifier = node.namedChildren[0];
    if (!funcIdentifier || funcIdentifier.type !== 'identifier') {
      return null;
    }

    const args: string[] = [];
    const argumentList = this.findChildByType(node, 'argument_list');
    if (argumentList) {
      for (const arg of argumentList.namedChildren) {
        args.push(arg.text);
      }
    }

    return {
      name: funcIdentifier.text,
      arguments: args,
      position: node.startPosition
    };
  }

  /**
   * 解析 include 指令
   */
  private parseIncludeDirective(node: ASTNode): IncludeDirective | null {
    const pathNode = this.findChildByType(node, 'string_literal') ||
                    this.findChildByType(node, 'system_lib_string');
    
    if (!pathNode) return null;

    const headerName = pathNode.text.replace(/[<>"]/g, '');
    const isSystemHeader = pathNode.text.startsWith('<');

    return {
      headerName,
      isSystemHeader,
      position: node.startPosition
    };
  }

  /**
   * 获取当前作用域
   */
  private getCurrentScope(node: ASTNode): string {
    // 检查是否是函数参数
    const paramDecl = this.findAncestorByType(node, 'parameter_declaration');
    if (paramDecl) {
      // 对于参数，作用域应该是其所属的函数名
      const funcDef = this.findAncestorByType(paramDecl, 'function_definition');
      if (funcDef) {
        const declarator = this.findChildByType(funcDef, 'function_declarator');
        if (declarator) {
          const identifier = this.findChildByType(declarator, 'identifier');
          if (identifier) {
            return identifier.text;
          }
        }
      }
    }

    // 简化实现，返回 global 或函数名
    const funcDef = this.findAncestorByType(node, 'function_definition');
    if (funcDef) {
      const declarator = this.findChildByType(funcDef, 'function_declarator');
      if (declarator) {
        const identifier = this.findChildByType(declarator, 'identifier');
        if (identifier) {
          return identifier.text;
        }
      }
    }
    return 'global';
  }

  /**
   * 检查节点是否是声明
   */
  private isDeclaration(node: ASTNode): boolean {
    const parent = node.parent;
    if (!parent) return false;

    return parent.type === 'declaration' || 
           parent.type === 'parameter_declaration' ||
           parent.type === 'init_declarator';
  }

  /**
   * 查找指定类型的子节点
   */
  private findChildByType(node: ASTNode, type: string): ASTNode | null {
    for (const child of node.namedChildren) {
      if (child.type === type) {
        return child;
      }
    }
    return null;
  }

  /**
   * 查找指定类型的所有子节点
   */
  private findChildrenByType(node: ASTNode, type: string): ASTNode[] {
    const children: ASTNode[] = [];
    for (const child of node.namedChildren) {
      if (child.type === type) {
        children.push(child);
      }
    }
    return children;
  }

  /**
   * 检查指定行是否在结构体定义内部
   */
  private isInStructDefinition(sourceLines: string[], lineNumber: number): boolean {
    // 检查前几行是否有未闭合的结构体定义
    let structStartFound = false;
    let braceBalance = 0;

    for (let i = Math.max(0, lineNumber - 20); i <= lineNumber; i++) {
      const line = sourceLines[i];

      // 查找结构体定义开始
      if (line.includes('typedef struct') || line.includes('struct ')) {
        structStartFound = true;
      }

      // 统计大括号
      const openCount = (line.match(/\{/g) || []).length;
      const closeCount = (line.match(/\}/g) || []).length;
      braceBalance += openCount - closeCount;

      // 如果找到结束的分号，说明结构体定义已完成
      if (structStartFound && braceBalance <= 0 && line.includes(';')) {
        structStartFound = false;
        braceBalance = 0;
      }
    }

    // 如果找到了结构体开始但大括号还没平衡，说明在结构体内部
    return structStartFound && braceBalance > 0;
  }

  /**
   * 查找指定类型的祖先节点
   */
  private findAncestorByType(node: ASTNode, type: string): ASTNode | null {
    let current = node.parent;
    while (current) {
      if (current.type === type) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }
}
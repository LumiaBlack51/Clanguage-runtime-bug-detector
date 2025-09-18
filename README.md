# Clanguage Runtime Bug Detector

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![tree-sitter](https://img.shields.io/badge/tree--sitter-0.22.4-green.svg)](https://tree-sitter.github.io/tree-sitter/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

一个基于**抽象语法树(AST)**的 C 代码安全扫描工具，使用 tree-sitter 进行精确的语法分析，检测常见的编程错误和安全问题。

## 🚀 核心技术

### AST精确分析
- **tree-sitter**: 使用高性能的 tree-sitter 解析器进行语法分析
- **精确变量识别**: 基于语法结构精确识别变量声明、使用和作用域
- **准确函数调用解析**: 精确解析函数调用及参数传递
- **完整头文件分析**: 准确解析 `#include` 指令和系统头文件

## 🔍 功能特性

### 核心检测功能
- **未初始化变量检测**: 基于 AST 精确追踪变量定义和使用
- **野指针检测**: 检测未初始化指针的解引用操作
- **空指针检测**: 检测空指针的解引用操作
- **库函数头文件检查**: 检查标准库函数是否包含正确的头文件
- **头文件拼写检查**: 使用编辑距离算法检测头文件名拼写错误
- **死循环检测**: 基于 AST 分析循环结构和退出条件
- **数值范围检查**: 检测赋值时数值是否超出变量类型范围
- **内存泄漏检测**: 追踪 malloc/free 配对，检测内存泄漏
- **printf/scanf格式检查**: 精确分析格式字符串与参数匹配

### AST高级特性
- **完整作用域分析**: 准确识别全局、函数、块级作用域
- **函数参数处理**: 精确识别函数参数，避免误报
- **结构体成员访问**: 支持复杂的结构体和指针操作
- **控制流分析**: 基于 AST 的控制流图分析
- **类型系统**: 完整的 C 类型系统支持

## 📦 安装与使用

### 依赖安装
```bash
npm install
```

### 编译
```bash
npm run compile
```

### 基本使用
```bash
# 独立命令行扫描
node ./out/interfaces/cli_standalone.js <目录路径>

# 扫描测试用例
npm run scan:buggy    # 扫描错误用例
npm run scan:correct  # 扫描正确用例
```

### VS Code 扩展
```bash
# 打包扩展
npm run vsce:package
```

安装生成的 `.vsix` 文件到 VS Code 中，即可使用图形界面进行扫描。

## 🏗️ 技术架构

### AST 解析核心
```typescript
// 核心AST解析器
export class CASTParser {
  parse(sourceCode: string): ASTNode;
  extractVariableDeclarations(ast: ASTNode): VariableDeclaration[];
  extractFunctionCalls(ast: ASTNode): FunctionCall[];
  extractIncludeDirectives(ast: ASTNode): IncludeDirective[];
}
```

### 模块化检测器
- **ASTVariableDetector**: 变量和指针分析
- **ASTLibraryDetector**: 库函数头文件检查
- **ASTAdvancedDetector**: 高级特性检测（循环、内存、格式等）

### 数据结构
```typescript
interface VariableDeclaration {
  name: string;
  type: string;
  isPointer: boolean;
  isArray: boolean;
  isInitialized: boolean;
  isParameter: boolean;
  isGlobal: boolean;
  position: { row: number; column: number };
  scope: string;
}

interface FunctionCall {
  name: string;
  arguments: string[];
  position: { row: number; column: number };
}
```

## 🎯 检测精度

### 优势对比
| 特性 | 启发式方法 | AST方法 |
|------|-----------|---------|
| 精确度 | 中等 | 高 |
| 误报率 | 较高 | 低 |
| 漏报率 | 中等 | 低 |
| 性能 | 快 | 中等 |
| 可维护性 | 困难 | 易于维护 |

### 检测能力统计
- **变量作用域分析**: ✅ 精确支持
- **函数调用解析**: ✅ 完全支持
- **头文件检查**: ✅ 标准库完整覆盖
- **内存管理**: ✅ malloc/free 配对检查
- **控制流分析**: ✅ AST级别分析
- **类型系统**: ✅ C语言完整类型支持

## 📊 测试用例

### 专门测试用例
- `tests/graphs/buggy/bug_43.c`: 库函数头文件检查测试
  - 包含 10+ 个未包含头文件的标准库函数调用
  - 测试 malloc, strlen, strcpy, isalpha, exit, time, rand 等函数

### 全面覆盖测试
- **错误测试用例**: 50+ 个包含各种 bug 的 C 文件
- **正确测试用例**: 验证无误报的正确 C 代码

## 📈 性能指标

基于 AST 的检测性能（相比启发式方法）：
- **精确度提升**: 显著提高
- **误报减少**: 大幅降低
- **检测覆盖**: 更全面的语法支持
- **维护性**: 代码结构清晰，易于扩展

## 🔧 技术实现

### AST 遍历算法
```typescript
// 深度优先遍历AST节点
function traverseAST(node: ASTNode, visitor: (node: ASTNode) => void) {
  visitor(node);
  for (const child of node.children) {
    traverseAST(child, visitor);
  }
}
```

### 变量作用域管理
```typescript
// 分层作用域栈
class ScopeManager {
  private scopes: Map<string, VariableDeclaration>[] = [];
  
  pushScope() { this.scopes.push(new Map()); }
  popScope() { this.scopes.pop(); }
  declare(variable: VariableDeclaration) { /* ... */ }
  lookup(name: string): VariableDeclaration | undefined { /* ... */ }
}
```

### 标准库函数数据库
```typescript
const STANDARD_LIBRARY_FUNCTIONS = {
  'stdio.h': ['printf', 'scanf', 'fprintf', 'fscanf', 'fopen', 'fclose', /* ... */],
  'stdlib.h': ['malloc', 'calloc', 'realloc', 'free', 'exit', 'atoi', /* ... */],
  'string.h': ['strlen', 'strcpy', 'strcat', 'strcmp', 'strstr', /* ... */],
  // ... 完整的标准库覆盖
};
```

## 🚀 开发历史

### v2.0.0 - AST 重构版本
- **完全重写**: 从启发式方法迁移到 AST 方法
- **依赖升级**: 添加 tree-sitter 和 tree-sitter-c
- **检测精度**: 大幅提升检测精确度
- **代码架构**: 模块化设计，易于维护和扩展

### 技术栈升级
- **tree-sitter v0.22.4**: 高性能语法解析器
- **tree-sitter-c v0.24.1**: C语言语法支持
- **TypeScript**: 类型安全的实现语言
- **模块化架构**: 清晰的分层设计

## 🔮 未来规划

### 短期目标
- **控制流图**: 实现更精确的控制流分析
- **数据流分析**: 跨函数的变量状态追踪
- **更多检测规则**: 添加缓冲区溢出、格式化字符串攻击等检测

### 长期目标
- **多语言支持**: 扩展到 C++ 等语言
- **IDE集成**: 更好的编辑器集成体验
- **实时分析**: 支持实时代码分析

## 🤝 贡献

欢迎贡献新的检测规则和改进：
1. Fork 项目
2. 创建功能分支
3. 添加测试用例
4. 提交 Pull Request

## 📄 许可证

MIT License
import * as fs from 'fs';
import * as path from 'path';
import { CASTParser, VariableDeclaration } from './src/core/ast_parser';

function debugAST() {
  const filePath = path.join(__dirname, 'tests', 'graphs', 'correct', 'avl_tree.c');
  const sourceCode = fs.readFileSync(filePath, 'utf8');
  const parser = new CASTParser();
  const ast = parser.parse(sourceCode);

  console.log('=== AST调试信息 ===');
  console.log('文件:', filePath);

  // 提取变量声明
  const declarations = parser.extractVariableDeclarations(ast, sourceCode.split('\n'));
  console.log('\n=== 变量声明 ===');
  declarations.forEach((decl: VariableDeclaration, index: number) => {
    console.log(`${index + 1}. ${decl.name}: type=${decl.type}, isParameter=${decl.isParameter}, isInitialized=${decl.isInitialized}, scope=${decl.scope}`);
  });

  // 查找函数定义
  function findFunctionDefinitions(node: any, functions: any[] = []) {
    if (node.type === 'function_definition') {
      functions.push(node);
    }
    for (const child of node.namedChildren) {
      findFunctionDefinitions(child, functions);
    }
    return functions;
  }

  const functions = findFunctionDefinitions(ast);
  console.log('\n=== 函数定义 ===');
  functions.forEach((func: any, index: number) => {
    const funcDecl = func.namedChildren.find((child: any) => child.type === 'function_declarator');
    if (funcDecl) {
      const identifier = funcDecl.namedChildren.find((child: any) => child.type === 'identifier');
      console.log(`${index + 1}. 函数: ${identifier ? identifier.text : 'unknown'}`);

      // 查找参数列表
      const paramList = funcDecl.namedChildren.find((child: any) => child.type === 'parameter_list');
      if (paramList) {
        console.log(`   参数列表:`);
        paramList.namedChildren.forEach((param: any, paramIndex: number) => {
          if (param.type === 'parameter_declaration') {
            console.log(`     参数 ${paramIndex + 1}: ${param.text}`);
          }
        });
      }
    }
  });
}

debugAST();
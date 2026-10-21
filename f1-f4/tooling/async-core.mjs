// One-time syntax-aware migration; original sources are preserved under f1-f4/baseline.
import ts from 'typescript';
import fs from 'node:fs';
const files=process.argv.includes('--tests')?['os-core/tests/persistence.test.ts']:['os-core/src/service.ts','os-core/src/authorization.ts'];
const f=ts.factory;
for(const file of files){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const transform=ctx=>{
  function visit(node){
   let n=ts.visitEachChild(node,visit,ctx);
   if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)){
    const e=n.expression;const base=node.expression.expression.getText(source);
    const target=base==='tx'||base==='this.authorization'||(base==='this'&&['activity','targetMember','document','incorporate','draft'].includes(e.name.text));
    if(target&&!(node.parent&&ts.isAwaitExpression(node.parent))) return f.createParenthesizedExpression(f.createAwaitExpression(n));
   }
   if((ts.isMethodDeclaration(n)||ts.isArrowFunction(n))&&n.body){
    let has=false;function scan(x){if(ts.isAwaitExpression(x))has=true;ts.forEachChild(x,scan);}scan(n.body);
    if(has){
     const mods=n.modifiers?.filter(m=>m.kind!==ts.SyntaxKind.AsyncKeyword)??[];mods.push(f.createModifier(ts.SyntaxKind.AsyncKeyword));
     const type=n.type&&!(ts.isTypeReferenceNode(n.type)&&n.type.typeName.getText(source)==='Promise')?f.createTypeReferenceNode('Promise',[n.type]):n.type;
     if(ts.isMethodDeclaration(n))n=f.updateMethodDeclaration(n,mods,n.asteriskToken,n.name,n.questionToken,n.typeParameters,n.parameters,type,n.body);
     else n=f.updateArrowFunction(n,mods,n.typeParameters,n.parameters,type,n.equalsGreaterThanToken,n.body);
    }
   }
   return n;
  }return n=>ts.visitNode(n,visit);
 };
 const transformed=ts.transform(source,[transform]);fs.writeFileSync(file,ts.createPrinter().printFile(transformed.transformed[0]));transformed.dispose();
}

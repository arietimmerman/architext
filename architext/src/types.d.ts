declare module 'nomnoml' {
  export function draw(canvas: HTMLCanvasElement, source: string, scale?: number): { config: any };
  export function renderSvg(source: string): string;
  export function renderSvgAdvanced(source: string): { svg: string; layout: any };
  export function compileFile(filePath: string): Promise<string>;
  export function processImports(source: string): string;
  export function processAsyncImports(source: string): Promise<string>;
  export class ImportDepthError extends Error {}
  export const version: string;
  export const skanaar: any;
  export function parse(source: string): any;
  export class ParseError extends Error {}
  export function layout(ast: any): any;
  export const styles: any;
  export const visualizers: any;
} 

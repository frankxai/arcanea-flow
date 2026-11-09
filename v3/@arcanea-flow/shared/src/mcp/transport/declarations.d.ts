/**
 * Declared types for express, cors, and helmet to satisfy TypeScript compilation
 */
declare module 'express' {
  export interface Request {
    [key: string]: any;
  }
  export interface Response {
    [key: string]: any;
  }
  export type NextFunction = (err?: any) => void;
  
  export interface Express {
    (req: any, res: any): void;
    [key: string]: any;
    use(...args: any[]): any;
    get(...args: any[]): any;
    post(...args: any[]): any;
    listen(...args: any[]): any;
  }
  
  const express: {
    (): Express;
    json(...args: any[]): any;
  };
  export default express;
}

declare module 'cors' {
  const cors: (options?: any) => any;
  export default cors;
}

declare module 'helmet' {
  const helmet: (options?: any) => any;
  export default helmet;
}

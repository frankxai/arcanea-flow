/**
 * Declared types for pg to satisfy TypeScript when dynamic importing pg
 */
declare module 'pg' {
  export class Client {
    constructor(config: any);
    connect(): Promise<void>;
    query(text: string, values?: any[]): Promise<any>;
    end(): Promise<void>;
  }
  export class Pool {
    constructor(config: any);
    connect(): Promise<any>;
    query(text: string, values?: any[]): Promise<any>;
    end(): Promise<void>;
    on(event: string, callback: (...args: any[]) => void): this;
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  }
}

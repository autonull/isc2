declare module 'onnxruntime-node' {
  export interface TensorType {
    data: Float32Array | Int32Array | Int64Array;
    dims: number[];
    type: 'float32' | 'int32' | 'int64' | 'uint8';
  }

  export interface SessionOptions {
    executionProviders?: Array<'cpu' | 'cuda' | 'tensorrt'>;
    graphOptimizationLevel?: 'disabled' | 'basic' | 'extended' | 'all';
  }

  export interface SessionHandler {
    inputNames: string[];
    outputNames: string[];
    run(feeds: Record<string, any>): Promise<Record<string, any>>;
  }

  export class InferenceSession {
    static Tensor: new (tensor: TensorType) => any;
    static create(modelPath: string, options?: SessionOptions): Promise<InferenceSession>;

    inputNames: string[];
    outputNames: string[];

    run(feeds: Record<string, any>): Promise<Record<string, any>>;
  }
}

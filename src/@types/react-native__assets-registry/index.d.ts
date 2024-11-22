declare module '@react-native/assets-registry/registry' {
    export interface PackagerAsset {
      name: string;
      type: string;
      scales: number[];
      hash: string;
      width?: number;
      height?: number;
    }
  }
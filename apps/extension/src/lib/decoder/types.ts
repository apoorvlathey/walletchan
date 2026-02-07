import { TransactionDescription } from "ethers";

export type DecodeBytesParamResult = {
  decoded: DecodeRecursiveResult;
};

export type DecodeTupleParamResult =
  | {
      name: string;
      baseType: string;
      type: string;
      rawValue: any;
      value: DecodeParamTypesResult;
    }[]
  | null;

export type DecodeArrayParamResult = {
  name: string;
  baseType: string;
  type: string;
  rawValue: any;
  value: DecodeParamTypesResult;
}[];

export interface ParsedTransaction extends TransactionDescription {
  txType?: "safeMultiSend" | "7821Execute" | "utf8TextMessage";
}

export type DecodeParamTypesResult =
  | string
  | DecodeBytesParamResult
  | DecodeTupleParamResult
  | DecodeArrayParamResult;

export type Arg = {
  name: string;
  baseType: string;
  type: string;
  rawValue: any;
  value: DecodeParamTypesResult;
};

export type DecodeRecursiveResult = {
  functionName: string;
  signature: string;
  rawArgs: any;
  args: Arg[];
} | null;

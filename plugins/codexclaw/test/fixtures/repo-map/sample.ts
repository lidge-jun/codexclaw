import { gammaHelper } from "./sample_helpers";

export interface BetaShape {
  id: string;
  weight: number;
}

export function alphaFn(shape: BetaShape): string {
  return gammaHelper(shape.id);
}

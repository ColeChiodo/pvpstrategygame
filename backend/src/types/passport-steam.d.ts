declare module "passport-steam" {
  import { Strategy } from "passport";
  export const Strategy: Strategy;
  interface Profile {
    id: string;
    displayName: string;
    photos: Array<{ value: string }> | undefined;
  }
}

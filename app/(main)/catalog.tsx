import { Redirect } from "expo-router";
import { Catalog } from "../../src/features/screens";
export default function Route() {
  return __DEV__ ? <Catalog /> : <Redirect href="/" />;
}

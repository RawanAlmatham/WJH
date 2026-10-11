import { Redirect } from "expo-router";
// A callback is accepted only by the in-flight auth session and its state verifier.
export default function AuthReturn() {
  return <Redirect href="/" />;
}

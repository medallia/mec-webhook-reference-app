import "./src/services/pushBackgroundHandler";
// Side effect: Android onReceived listener before App mounts.
import "./src/services/notifications";
import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);

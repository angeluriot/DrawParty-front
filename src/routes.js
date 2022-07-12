import Home from "./lib/views/Home.svelte";
import NotFound from "./lib/views/NotFound.svelte";

export const routes = {
  "/": Home,
  "*": NotFound,
};

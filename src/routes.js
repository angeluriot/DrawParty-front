import Home from "./lib/views/Home.svelte";
import Counter from "./lib/components/Counter.svelte";
import NotFound from "./lib/views/NotFound.svelte";

export const routes = {
	"/": Home,
	"/counter": Counter,
	"*": NotFound,
};

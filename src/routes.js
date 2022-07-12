import Home from "./lib/views/Home.svelte";
import DrawTest from "./lib/views/DrawTest.svelte";
import NotFound from "./lib/views/NotFound.svelte";

export const routes = {
	"/": Home,
	"/drawtest": DrawTest,
	"*": NotFound,
};

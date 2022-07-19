import Home from "./lib/views/Home.svelte";
import Party from "./lib/views/Party.svelte";
import NotFound from "./lib/views/NotFound.svelte";

export const routes = {
	"/": Home,
	"/join/:partyId": Home,
	"/party": Party,
	"*": NotFound,
};

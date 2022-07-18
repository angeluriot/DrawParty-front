export default class Action {
	type: string;
	data: any;
	undone: boolean;
	id: number;
	layer: number;
	confirmed: boolean;
	player: string;

	constructor(type: string, data: any, id: number, layer: number, confirmed: boolean, player: string) {
		this.type = type;
		this.data = data;
		this.undone = false;
		this.id = id;
		this.layer = layer;
		this.confirmed = confirmed;
		this.player = player;
	}
}

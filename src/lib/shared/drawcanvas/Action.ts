export default class Action {
	type: string;
	data: any;
	undone: boolean;
	id: number;
	layer: number;

	constructor(type: string, data: any, id: number, layer: number) {
		this.type = type;
		this.data = data;
		this.undone = false;
		this.id = id;
		this.layer = layer;
	}
}

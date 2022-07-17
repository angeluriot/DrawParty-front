export function getCursor(number: number, min: number, max: number)
{
	return (number - min) / (max - min);
}

export function getMix(value_1: number, value_2: number, cursor: number)
{
	return value_1 + (value_2 - value_1) * cursor;
}

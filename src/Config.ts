
export class Config {
    private static _instance: Config;

    public static runAgain: string = '';

    private constructor() {
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention
    public static get Instance() {
        return this._instance || (this._instance = new this());
    }
}



export const EXT_NAME = "clickmake";
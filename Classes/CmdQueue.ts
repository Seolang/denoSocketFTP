// This class is Command Queue Class used to save and execute 
// socket command synchronously.

export class Queue {
    _arr:CmdBlock[]

    constructor() {
      this._arr = [];
    }
    // Queue Put
    enqueue(item:CmdBlock) {
      this._arr.push(item);
    }
    // Queue Pop, return out component
    dequeue() {
      return this._arr.shift();
    }
    // return remain Queue length
    length() {
        return this._arr.length;
    }

}

// structure to put command and pathes into Command Queue
export class CmdBlock {
    cmd: number
    path: string
    dest: string

    constructor(cmd:number = 0, path:string = ``, dest:string = ``) {
        this.cmd = cmd
        this.path = path
        this.dest = dest
    }
}
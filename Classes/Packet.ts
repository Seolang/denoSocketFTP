// Common Packet Interface
export interface Packet {
    getBytes(): Uint8Array  // Return Bytes Array of Packet
    getSize(): number       // Return Size of Packet
}

// Implementation of Packet Contents
export class Message implements Packet {
    header: Header  // 11 Bytes header
    body: Packet    // Request, Response, Data, Result

    constructor(header: Header, body: Packet) {
        this.header = header
        this.body = body
    }

    public getBytes() {
        const temp =  new Uint8Array([...this.header.getBytes(), ...this.body.getBytes()])
        return temp
    }

    public getSize() {
        return this.header.getSize() + this.body.getSize()
    }

    // Static function that returns Message filled with 0, so this contains no Cmd or data
    // This Message is used to send Error status to both server and client, so they can ack and reset their connect
    public static nullMessage() {
        const header = Header.makeHeader(0,0,0,0)
        const body = RequestBody.makeReqBody(0, '')
        return new Message(header, body)
    }
}

// Header class
export class Header implements Packet {
    typeMSG: number     // message type
    typeCMD: number     // command type
    bodyLen: number     // body packet length (need to read length)
    lastMSG: number     

    constructor(bytes: Uint8Array) {
        const len = bytes.slice(2,14)
        this.typeMSG = bytes[0]     // 1: Request, 2: Response, 3: Data, 4: Result
        this.typeCMD = bytes[1]     // 1: Save, 2: Load, 3: Delete
        this.bodyLen = Number(new TextDecoder().decode(len))        // size of body right behind packet contents
        this.lastMSG = bytes[14]    // 1: this packet is last, 0: there are more packets which divided from one source
    }

    public getBytes() {
        const len = '000000000000'+this.bodyLen.toString()
        const lenTo12 = len.slice(len.length-12,len.length)
        const bytes = new Uint8Array(new TextEncoder().encode(lenTo12))
        const temp = new Uint8Array([this.typeMSG, this.typeCMD, ...bytes, this.lastMSG ])

        return temp
    }

    public getSize() {
        return 15
    }

    // Because Javascript doesn't support Constructor Overload,
    // Add this static function to make header easier
    public static makeHeader(MSG:number, CMD:number, Len:number, last:number) {
        const header = new Header(new Uint8Array(15))
        header.typeMSG = MSG
        header.typeCMD = CMD
        header.bodyLen = Len
        header.lastMSG = last

        return header
    }
}

export class RequestBody implements Packet {
    FILESIZE: number    //Request file size
    FILENAME: Uint8Array    //Request file path/name

    constructor(bytes:Uint8Array) {
        this.FILESIZE = Number(new TextDecoder().decode(bytes.slice(0, 12)))
        this.FILENAME = new Uint8Array(bytes.slice(12, bytes.length))
    }

    public getBytes() {
        const len = '000000000000'+this.FILESIZE.toString()
        const lenTo12 = len.slice(len.length-12,len.length)
        const numString = new Uint8Array(new TextEncoder().encode(lenTo12))
        const bytes = new Uint8Array([...numString, ...this.FILENAME])
        return bytes
    }

    public getSize() {
        return 12 + this.FILENAME.length
    }

    // Instead of Constructor Overload
    public static makeReqBody(size: number, name: string) {
        const body = new RequestBody(new Uint8Array(15))
        body.FILESIZE = size
        body.FILENAME = new TextEncoder().encode(name)

        return body
    }

}

export class ResponseBody implements Packet {
    RESPONSE: number    // 1: ACCEPTED, 0: DENIED
    
    constructor(bytes:Uint8Array) {
        this.RESPONSE = bytes[0]
    }

    public getBytes() {
        return new Uint8Array([this.RESPONSE])
    }

    public getSize() {
        return 1
    }
}

export class DataBody implements Packet {
    DATA: Uint8Array    // Bytes array of data


    constructor(bytes:Uint8Array) {
        this.DATA = new Uint8Array([...bytes])
    }

    public getBytes() {
        return this.DATA
    }

    public getSize() {
        return this.DATA.length
    }
}

export class ResultBody implements Packet {
    RESULT: number  // 1: SUCCESS, 0: FAIL
    
    constructor(bytes:Uint8Array) {
        this.RESULT = bytes[0]
    }

    public getBytes() {
        return new Uint8Array([this.RESULT])
    }

    public getSize() {
        return 1
    }
}

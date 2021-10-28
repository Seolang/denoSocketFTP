import {Message, Header, RequestBody, ResponseBody, DataBody, ResultBody} from "./Packet.ts"
import {Const} from "./Const.ts"

export class PacketUtil {
    public static async Send(conn: Deno.Conn, packet:Message) {
        await conn.write(packet.getBytes())
    }

    public static async Receive(conn: Deno.Conn): Promise<Message> {
        let sizeToRead = 11
        const hBuffer = new Uint8Array(sizeToRead)
        let recv = await conn.read(hBuffer)
        if (recv == null) {
            throw new Error(`No header received`)
        }
        const header = new Header(hBuffer)

        sizeToRead = header.bodyLen
        const bBuffer = new Uint8Array(sizeToRead)
        recv = await conn.read(bBuffer)
        if (recv == null) {
            throw new Error(`No body received`)
        }

        let body
        switch (header.typeMSG) {
            case Const.MSG_REQ:
                body = new RequestBody(bBuffer)
                break

            case Const.MSG_RES:
                body = new ResponseBody(bBuffer)
                break

            case Const.MSG_SND:
                body = new DataBody(bBuffer)
                break

            case Const.MSG_RST:
                body = new ResultBody(bBuffer)
                break

            default:
                throw new Error(`MSG Format missmatch`)
        }

        return new Message(header, body)        
    }
}
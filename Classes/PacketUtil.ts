// This Class contains Packet Sending and Receiving implement methods


import {Message, Header, RequestBody, ResponseBody, DataBody, ResultBody} from "./Packet.ts"
import {Const} from "./Const.ts"

export class PacketUtil {

    // Packet Send method
    // Params
    // conn: connection of server or client
    // packet: contents which you want to send
    public static async Send(conn: Deno.Conn, packet:Message) {
        await conn.write(packet.getBytes())
    }

    // Packet Receive method
    // Param conn: connection of server or client
    public static async Receive(conn: Deno.Conn): Promise<Message> {
        let sizeToRead = 11     // Header fixed bytes size
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

        //reform body contents into appropriate body
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
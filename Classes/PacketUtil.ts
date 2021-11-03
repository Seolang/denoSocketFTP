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
        let sizeToRead = 15     // Header fixed bytes size
        let totalRecv = 0
        const hBuffer = new Uint8Array(sizeToRead)
        while(sizeToRead > 0) {
            const buffer = new Uint8Array(sizeToRead)
            const recv = await conn.read(buffer)
            if (recv == null) {
                throw new Error(`No header received`)
            }
            // copy buffer data to header buffer
            for(let i=0; i < recv; i++) {
                hBuffer[totalRecv+i] = buffer[i]
            }
            totalRecv += recv
            sizeToRead -= recv
        }
        const header = new Header(hBuffer)
        console.log(`${header.typeMSG} ${header.typeCMD} ${header.bodyLen} ${header.lastMSG}`)

        totalRecv = 0
        sizeToRead = header.bodyLen
        const bBuffer = new Uint8Array(sizeToRead)
        while(sizeToRead > 0) {
            const buffer = new Uint8Array(sizeToRead)
            const recv = await conn.read(buffer)
            if (recv == null) {
                throw new Error(`No body received`)
            }
            for(let i=0; i < recv; i++) {
                bBuffer[totalRecv+i] = buffer[i]
            }
            totalRecv += recv
            sizeToRead -= recv
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
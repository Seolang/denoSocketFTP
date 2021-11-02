import {Const} from "./Const.ts"
import {decoder, exists} from "./Functions.ts"
import {Message, Header, RequestBody, ResponseBody, DataBody, ResultBody} from "./Packet.ts"
import {PacketUtil} from "./PacketUtil.ts"
import {ensureFileSync} from "../dept.ts"

export class Server {
    serverConn: Deno.Conn 

    constructor(conn: Deno.Conn) {
        this.serverConn = conn
    }

    reConnect(conn: Deno.Conn) {
        try {
            this.serverConn = conn
        }
        catch (e) {
            console.log(`(Accept Error)\n`+e)
        }
    }

    async save(bytes: Uint8Array) {
        try {
            const body = new RequestBody(bytes)
            const fileName = Const.PATH+decoder.decode(body.FILENAME)
            const fileSize = body.FILESIZE
            try {
                if (!await exists(fileName))
                    ensureFileSync(fileName)

                await PacketUtil.Send(this.serverConn, 
                    new Message(Header.makeHeader(Const.MSG_RES, Const.CMD_SAVE, 1, Const.LASTMSG), 
                    new ResponseBody(new Uint8Array([Const.ACCEPTED]))))
            } catch {
                await PacketUtil.Send(this.serverConn, 
                    new Message(Header.makeHeader(Const.MSG_RES, Const.CMD_SAVE, 1, Const.LASTMSG), 
                    new ResponseBody(new Uint8Array([Const.DENIED]))))

                return
            }
            try{
                const mem = new Uint8Array(fileSize)
                let lastMSG = 0
                let totalRecv = 0

                while(lastMSG === Const.NOT_LASTMSG && totalRecv < fileSize) {
                    const message = await PacketUtil.Receive(this.serverConn)
                    const dHeader = message.header
                    if (dHeader.typeMSG !== Const.MSG_SND)
                        throw new Error(`Invalid Packet Order`)

                    const dBody = new DataBody(message.body.getBytes())
                    for (let i = totalRecv, j = 0; i < totalRecv + dBody.getSize(); i++) {
                        mem[i] = dBody.DATA[j++]
                    }
                    lastMSG = dHeader.lastMSG
                    totalRecv += dBody.getSize()

                    if(totalRecv >= 1024000) {
                        const resHeader = Header.makeHeader(Const.MSG_RES, Const.CMD_LOAD, 1, Const.LASTMSG)
                        const resBody = new ResponseBody(new Uint8Array([Const.ACCEPTED]))
                        await PacketUtil.Send(this.serverConn, new Message(resHeader, resBody))
                    }
                }

                const rstHeader = Header.makeHeader(Const.MSG_RST, Const.CMD_SAVE, 1, Const.LASTMSG)
                if (totalRecv !== fileSize) {
                    await PacketUtil.Send(this.serverConn, 
                        new Message(rstHeader, new ResultBody(new Uint8Array([Const.FAIL]))))

                    await Deno.remove(fileName)
                    throw new Error(`File Size Mismatch`)
                }
            
                await Deno.writeFile(fileName, mem)

                await PacketUtil.Send(this.serverConn, 
                    new Message(rstHeader, new ResultBody(new Uint8Array([Const.SUCCESS]))))

            } catch(e) {
                const rstHeader = Header.makeHeader(Const.MSG_RST, Const.CMD_SAVE, 1, Const.LASTMSG)
                await PacketUtil.Send(this.serverConn, 
                    new Message(rstHeader, new ResultBody(new Uint8Array([Const.FAIL]))))
                throw new Error(`Failed to Save File\n`+e)
            }
        } catch(e) {
            await PacketUtil.Send(this.serverConn, Message.nullMessage())
            throw e
        }
    }

    async load(bytes: Uint8Array) {
        try {
            //check if file exist in server backup dir
            const reqFile = Const.PATH+decoder.decode(new RequestBody(bytes).FILENAME)

            //if not exist, send Deny Response, else, send Accpet response
            if (!await exists(reqFile)) {
                await PacketUtil.Send(this.serverConn, 
                    new Message(Header.makeHeader(Const.MSG_RES, Const.CMD_LOAD, 1, Const.LASTMSG), 
                    new ResponseBody(new Uint8Array([Const.DENIED]))))

                return
            }
            await PacketUtil.Send(this.serverConn, 
                new Message(Header.makeHeader(Const.MSG_RES, Const.CMD_LOAD, 1, Const.LASTMSG), 
                new ResponseBody(new Uint8Array([Const.ACCEPTED]))))

            // Send File info into Request Message to client
            const file = await Deno.readFile(reqFile)
            const reqBody = RequestBody.makeReqBody(file.length, '')
            const reqHeader = Header.makeHeader(Const.MSG_REQ, Const.CMD_LOAD, reqBody.getSize(), Const.LASTMSG)
            await PacketUtil.Send(this.serverConn, new Message(reqHeader, reqBody))
            
            try {
                let totalSend = 0
                // Splice Data under DATACHUNK(1013 Bytes default) Bytes, (11 header + 1013? data =< 1024 Bytes )
                // And then put each data into Message and send it to Client while send all data
                while(totalSend < file.length) {
                    const dataLen = (file.length-totalSend) > Const.DATACHUNK ? Const.DATACHUNK : (file.length-totalSend)
                    const dBody = new DataBody(file.slice(totalSend, totalSend+dataLen))
                    totalSend += dataLen
                    const lastMSG = totalSend === file.length ? Const.LASTMSG : Const.NOT_LASTMSG
                    const dHeader = Header.makeHeader(Const.MSG_SND, Const.CMD_LOAD, dataLen, lastMSG)
                    await PacketUtil.Send(this.serverConn, new Message(dHeader, dBody))

                    if (totalSend >= 1024000) {
                        const ruOK = await PacketUtil.Receive(this.serverConn)
                        const answer = new ResponseBody(ruOK.body.getBytes())
                        if (answer.RESPONSE !== Const.ACCEPTED || ruOK.header.typeMSG !== Const.MSG_RES) 
                            throw new Error(`Client didn't response`);
                    }
                }

            } catch(e) {
                throw new Error(`Failed to Load File\n`+e)
            }

        } catch(e) {
            await PacketUtil.Send(this.serverConn, Message.nullMessage())
            throw e
        }
    }

    async delete(bytes: Uint8Array) {
        try {
            
            const recursive = new RequestBody(bytes).FILESIZE
            const delFile = Const.PATH+decoder.decode(new RequestBody(bytes).FILENAME)

            if (delFile.startsWith(Const.PATH+`..`)) {
                await PacketUtil.Send(this.serverConn, 
                    new Message(Header.makeHeader(Const.MSG_RST, Const.CMD_DELETE, 1, Const.LASTMSG), 
                    new ResponseBody(new Uint8Array([Const.FAIL]))))
                return
            }

            if (!await exists(delFile)) {
                await PacketUtil.Send(this.serverConn, 
                    new Message(Header.makeHeader(Const.MSG_RES, Const.CMD_DELETE, 1, Const.LASTMSG), 
                    new ResponseBody(new Uint8Array([Const.DENIED]))))

                return
            }

            try {
                if (recursive)
                    Deno.removeSync(delFile, {recursive:true})
                else
                    Deno.removeSync(delFile)

                await PacketUtil.Send(this.serverConn, 
                    new Message(Header.makeHeader(Const.MSG_RST, Const.CMD_DELETE, 1, Const.LASTMSG), 
                    new ResponseBody(new Uint8Array([Const.SUCCESS]))))
            } catch(e) {
                console.log(`Delete Error\n`+e)
                await PacketUtil.Send(this.serverConn, 
                    new Message(Header.makeHeader(Const.MSG_RST, Const.CMD_DELETE, 1, Const.LASTMSG), 
                    new ResponseBody(new Uint8Array([Const.FAIL]))))
            }
        } catch(e) {
            await PacketUtil.Send(this.serverConn, Message.nullMessage())
            throw e
        }
    }

    async clearAll() {
        try {
            Deno.removeSync(Const.PATH, {recursive:true})
            await PacketUtil.Send(this.serverConn, 
                new Message(Header.makeHeader(Const.MSG_RST, Const.CMD_CLEAR, 1, Const.LASTMSG), 
                new ResponseBody(new Uint8Array([Const.SUCCESS]))))

        } catch(e) {
            await PacketUtil.Send(this.serverConn, Message.nullMessage())
            throw e
        }
    }
}
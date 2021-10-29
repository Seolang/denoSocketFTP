import {Queue, CmdBlock} from "./CmdQueue.ts"
import {Const} from "./Const.ts"
import {decoder, exists} from "./Functions.ts"
import {Message, Header, RequestBody, DataBody, ResultBody} from "./Packet.ts"
import {PacketUtil} from "./PacketUtil.ts"
import {ensureFileSync} from "../dept.ts" 

export class Client {
    clientConn: Deno.Conn
    cmdQue: Queue
    isWorking = false
    port = Const.port
    host = Const.host

    //Constructor
    constructor(conn: Deno.Conn) {
        this.clientConn = conn
        this.cmdQue = new Queue()
    }

    //Try Reconnection Function to the set port and host
    async reConnect() {
        try {
            this.clientConn = await Deno.connect({port: this.port, transport: "tcp", hostname: this.host})
        } catch (e) {
            console.log(`(Connection Error)\n`+e)
            this.reConnect()
        }
    }

    //Disconnect Socket Connection
    close() {
        this.clientConn.close()
    }

    //Save function
    async save(path: string, dest = '') {
        try {
            //Check if file exist, if not, throw Error to runCmd function
            if (!await exists(path)) {
                console.log(`There's no file "${path}" exist`)
                return
            }

            if (dest === '') {
                dest = path
            }

            // Request MSG to server
            const file = await Deno.readFile(path)
            const reqBody = RequestBody.makeReqBody(file.length, dest)
            const reqHeader = Header.makeHeader(Const.MSG_REQ, Const.CMD_SAVE, reqBody.getSize(), Const.LASTMSG)
            await PacketUtil.Send(this.clientConn, new Message(reqHeader, reqBody))

            // Receive Response and if req accepted,
            const response = await PacketUtil.Receive(this.clientConn)
            if(response.header.typeMSG !== Const.MSG_RES)
                throw new Error(`Invalid Packet Order`)

            if (response.body.getBytes()[0] === Const.ACCEPTED) {
                console.log(`start Save ${path} to ${Const.PATH+dest}`)
                let totalSend = 0

                // Splice Data under DATACHUNK(1013 Bytes default) Bytes, (11 header + 1013? data =< 1024 Bytes )
                // And then put each data into Message and send it to Server while send all data
                while(totalSend < file.length) {
                    const dataLen = (file.length-totalSend) > Const.DATACHUNK ? Const.DATACHUNK : (file.length-totalSend)
                    const dBody = new DataBody(file.slice(totalSend, totalSend+dataLen))
                    totalSend += dataLen
                    const lastMSG = totalSend === file.length ? Const.LASTMSG : Const.NOT_LASTMSG
                    const dHeader = Header.makeHeader(Const.MSG_SND, Const.CMD_SAVE, dataLen, lastMSG)
                    await PacketUtil.Send(this.clientConn, new Message(dHeader, dBody))
                }

                // Receive Result Message
                const result = await PacketUtil.Receive(this.clientConn)
                if(result.header.typeMSG !== Const.MSG_RST)
                    throw new Error(`Invalid Packet Order`)

                const rstBody = new ResultBody(result.body.getBytes())

                if (rstBody.RESULT === Const.SUCCESS) {
                    console.log(`Save Completed`)
                }
                else {
                    console.log(`Save Fail`)
                }
            }
            else {
                console.log(`Save Request Denied`)
            }
        } catch(e) {
            await PacketUtil.Send(this.clientConn, Message.nullMessage())
            throw e
        }
    }

    //Load Function
    async load(path: string, dest: string) {
        try {
            if (dest === '') {
                dest = path
            }

            // Send Req load file to Server
            const reqBody = RequestBody.makeReqBody(0, path)
            const reqHeader = Header.makeHeader(Const.MSG_REQ, Const.CMD_LOAD, reqBody.getSize(), Const.LASTMSG)
            await PacketUtil.Send(this.clientConn, new Message(reqHeader, reqBody))

            // Receive response, if file doesn't exist or somethings wrong, exit to else
            const response = await PacketUtil.Receive(this.clientConn)
            if(response.header.typeMSG !== Const.MSG_RES)
                    throw new Error(`Invalid Packet Order`)
            
            if (response.body.getBytes()[0] === Const.ACCEPTED) {
                console.log(`start Load ${Const.PATH+path} to ${dest}`)
                // Receive file size info from server by using Req Message.
                const fileSize = new RequestBody((await PacketUtil.Receive(this.clientConn)).body.getBytes()).FILESIZE
                
                // check if file exist, if not, make empty file
                try {
                    if(!await exists(dest))
                        ensureFileSync(dest)

                    const mem = new Uint8Array(fileSize)
                    let lastMSG = 0
                    let totalRecv = 0

                    // Receive Data
                    while(lastMSG === Const.NOT_LASTMSG && totalRecv < fileSize) {
                        const message = await PacketUtil.Receive(this.clientConn)
                        const dHeader = message.header
                        if(dHeader.typeMSG !== Const.MSG_SND)
                            throw new Error(`Invalid Packet Order`)

                        const dBody = new DataBody(message.body.getBytes())
                        for (let i = totalRecv, j = 0; i < totalRecv + dBody.getSize(); i++) {
                            mem[i] = dBody.DATA[j++]
                        }
                        lastMSG = dHeader.lastMSG
                        totalRecv += dBody.getSize()
                    }

                    if (mem.length !== fileSize) {
                        Deno.remove(dest)
                        throw new Error(`File Size Mismatch`)
                    }
                
                    await Deno.writeFile(dest, mem)
                    console.log(`Load Complete`)

                } catch(e) {
                    throw new Error(`Failed to Load File\n`+e)
                }
            }
            else {
                console.log(`File is not Exist`)
            }
        } catch (e) {
            await PacketUtil.Send(this.clientConn, Message.nullMessage())
            throw e
        }
    }

    //Delete Function
    async delete(path: string, option: string) {
        try {
            // Send Req delete
            const recursive = option == '-r' ? 1 : 0
            const reqBody = RequestBody.makeReqBody(recursive, path)
            const reqHeader = Header.makeHeader(Const.MSG_REQ, Const.CMD_DELETE, reqBody.getSize(), Const.LASTMSG)
            await PacketUtil.Send(this.clientConn, new Message(reqHeader, reqBody))

            // Receive response, if file doesn't exist or somethings wrong, exit to else
            const response = await PacketUtil.Receive(this.clientConn)
            if (response.header.typeMSG === Const.MSG_RES) {
                console.log(`File Not Found`)
            }
            else if(response.header.typeMSG === Const.MSG_RST) {
                if(response.body.getBytes()[0] === Const.SUCCESS) {
                    console.log(`Delete Complete`)
                }
                else {
                    console.log(`Fail to delete file`)
                }
            }
            else {
                throw new Error(`Invalid Packet Order`)
            }
                               
        } catch(e) {
            await PacketUtil.Send(this.clientConn, Message.nullMessage())
            throw e
        }
    }

    async clearAll() {
        try {
            // Send Req clear All
            const reqBody = RequestBody.makeReqBody(0, '')
            const reqHeader = Header.makeHeader(Const.MSG_REQ, Const.CMD_CLEAR, reqBody.getSize(), Const.LASTMSG)
            await PacketUtil.Send(this.clientConn, new Message(reqHeader, reqBody))

            const result = await PacketUtil.Receive(this.clientConn)

            if (result.header.typeMSG === Const.MSG_RST && result.body.getBytes()[0] === Const.SUCCESS)
                console.log(`Successfully clear all files`)
            else
                console.log(`Fail to delete all files`)

        } catch(e) {
            await PacketUtil.Send(this.clientConn, Message.nullMessage())
            throw e
        }
    }

    //Queue Observe and Execute
    async runCmd() {
        if (this.cmdQue.length() != 0 && this.isWorking === false) {
            try {
                const cmdBlock = this.cmdQue.dequeue()
                this.isWorking = true
                if (cmdBlock) {
                    switch (cmdBlock.cmd) {
                        case Const.CMD_SAVE:
                            await this.save(cmdBlock.path, cmdBlock.dest)
                            break

                        case Const.CMD_LOAD:
                            await this.load(cmdBlock.path, cmdBlock.dest)
                            break
                        
                        case Const.CMD_DELETE:
                            await this.delete(cmdBlock.path, cmdBlock.dest)
                            break

                        case Const.CMD_EXIT:
                            console.log(`Exit Program`)
                            this.close()
                            Deno.exit()
                            break

                        case Const.CMD_CLEAR:
                            await this.clearAll()
                            break
                        
                        default:
                            console.log(`Command Queue Error`)
                    }                   
                }
            } catch(e) {
                console.log(`(Error runCmd)\n`+e)
                await this.reConnect()
            } finally {
                this.isWorking = false;
                this.runCmd()
            }
        }
    }

    //CMD Select processing function
    async selectCmd() {
        console.log(`\n=======================Start File Transfer System======================\n`)
        console.log(`1: save file   2: load file    3: delete file    4: exit   5: clear\n`)
        console.log(`Type Command: ex) save 1.jpg backup.jpg`)
        const command = await this.cmd() || '0'
        if(command[0] === 'save') {
            this.cmdQue.enqueue(new CmdBlock(Const.CMD_SAVE, command[1], command[2]))
        }
        else if (command[0] === 'load') {
            this.cmdQue.enqueue(new CmdBlock(Const.CMD_LOAD, command[1], command[2]))
        }
        else if (command[0] === 'delete') {
            this.cmdQue.enqueue(new CmdBlock(Const.CMD_DELETE, command[1], command[2]))
        }
        else if (command[0] === 'exit') {
            this.cmdQue.enqueue(new CmdBlock(Const.CMD_EXIT))
        }
        else if (command[0] === 'clear') {
            this.cmdQue.enqueue(new CmdBlock(Const.CMD_CLEAR))
        }
        else{
            console.log(`You typed wrong command`)
        }
        this.runCmd()
    }

    // Take Input From Console
    async cmd() {
        const buf = new Uint8Array(100)
        const len = await Deno.stdin.read(buf) || 0
        const command = decoder.decode(buf.slice(0, len-2))
        const temp = command.split(' ')

        return temp
    }
}
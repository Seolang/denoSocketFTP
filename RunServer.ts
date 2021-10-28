import {Server} from "./Classes/Server.ts"
import {Const} from "./Classes/Const.ts"
import {PacketUtil} from "./Classes/PacketUtil.ts"

const Listen = Deno.listen({port:Const.port, transport:"tcp", hostname:Const.host})
const server = new Server(await Listen.accept())
while(1) {
    try {
        const req = await PacketUtil.Receive(server.serverConn)
        if(req.header.typeMSG !== Const.MSG_REQ) {
            server.serverConn.close()
            throw new Error(`Protocol Order Problem`)
        }
        switch(req.header.typeCMD) {
            case Const.CMD_SAVE:
                await server.save(req.body.getBytes())
                break
            
            case Const.CMD_LOAD:
                await server.load(req.body.getBytes())
                break

            case Const.CMD_DELETE:
                await server.delete(req.body.getBytes())
                break

            default:
                throw new Error(`Invalid Command Received`)
        }
    } catch (e) {
        console.log(`(error)\n`+e)
        server.serverConn.close()
        server.reConnect(await Listen.accept())
    }
}
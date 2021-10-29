// Server endlessly run by this file.

import {Server} from "./Classes/Server.ts"
import {Const} from "./Classes/Const.ts"
import {PacketUtil} from "./Classes/PacketUtil.ts"
import {username, getNetworkAddr} from "./dept.ts"

console.log(await username())
console.log(await getNetworkAddr())
// Start listning connection signal from port and hostname in Const class
const Listen = Deno.listen({port:Const.port, transport:"tcp", hostname:Const.host})
// Waiting first connect with client
const server = new Server(await Listen.accept())
while(1) {
    try {
        // Receive request from Client 
        const req = await PacketUtil.Receive(server.serverConn)
        // If message is not Req, message orders are wrong so throw error
        // and let the server try reconnect
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

            case Const.CMD_CLEAR:
                await server.clearAll()
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
import { Client } from "./Classes/Client.ts"
import {Const} from "./Classes/Const.ts"
const conn = await Deno.connect({port:Const.port, transport:"tcp", hostname:Const.host})
const client = new Client(conn)
while(1) {
    client.runCmd()
    await client.selectCmd()
}

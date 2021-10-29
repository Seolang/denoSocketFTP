// Temporal Client running file.
// This will be changed into function call

import { Client } from "./Classes/Client.ts"
import {Const} from "./Classes/Const.ts"
// try to connect socket
const conn = await Deno.connect({port:Const.port, transport:"tcp", hostname:Const.host})
// make Client class with connection
const client = new Client(conn)
// this will running forever
// client.runCmd() function in client.selectCmd() will run asynchrounously 
// so while taking input from console, this function will run and execute commands in Command Queue

while(1) {
    await client.selectCmd()
}

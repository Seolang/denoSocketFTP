export class Const{
    static CMD_SAVE = 1
    static CMD_LOAD = 2
    static CMD_DELETE = 3
    static CMD_EXIT = 4
    static CMD_CLEAR = 5

    static MSG_REQ = 1
    static MSG_RES = 2
    static MSG_SND = 3
    static MSG_RST = 4

    static LASTMSG = 1
    static NOT_LASTMSG = 0

    static ACCEPTED = 1
    static DENIED = 0

    static SUCCESS = 1
    static FAIL = 0

    static port = 10000
    static host = '203.251.115.168'

    static USR = 'root'
    static BACKUPPATH = '/Backup/'

    static PATH = './Backup/'
    static DATACHUNK = 1009
}
import * as moment from 'moment'

const momentURL = "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.19.4/moment.min.js";
function main() {
    eval(UrlFetchApp.fetch(momentURL).getContentText());
    Logger.log(`this['moment']: ${this["moment"]}`);
    Logger.log(`this.module: ${this.module}`);
    for (let key in this.module)
        Logger.log(`this.module[${key}]: ${this.module[key]}`);
    const moment = this.module.exports;
    Logger.log(moment().format("YYYY"));
}

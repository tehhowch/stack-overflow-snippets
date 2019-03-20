/** nested_json_parsing.js
 * Copyright (c) 2019 by tehhowch
 * This is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 * This is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE.  See the GNU General Public License for more details.
 */
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

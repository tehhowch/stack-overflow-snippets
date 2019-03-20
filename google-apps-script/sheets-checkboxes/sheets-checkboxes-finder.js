/** sheets-checkboxes-finder.js
 * Copyright (c) 2019 by tehhowch
 * This is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 * This is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE.  See the GNU General Public License for more details.
 */
//@ts-check

/**
 * This Apps Script file demonstrates how to properly acquire "Checkboxes" in
 * the Google Sheets application. Checkboxes may have any associated values for
 * the "checked" and "unchecked" state, and thus one must not assume that these
 * elements can be assigned `true` or `false` or any variation thereof.
 *
 * Probably a smart developer would combine finding these checkboxes with serializing
 * their shorthand, either on a sheet-style database, in CacheService, or in
 * PropertiesService, to avoid constant requerying of their locations when
 * choosing to modify their checked & unchecked states.
 */

/**
 * @typedef {Object} CheckboxSpec
 * @property {number} rowIndex The 0-based row index of the checkbox in its sheet
 * @property {number} colIndex The 0-based column index of the checkbox in its sheet
 * @property {string} r1c1 The R1C1 style cell address of the checkbox in its sheet
 * @property {any[]} choices The ordered array of checked and unchecked values for the checkbox (default [true, false])
 * @property {any} value The current value of the checkbox's cell
 */

function getAllCheckboxesViaService() {
    const wb = SpreadsheetApp.getActive();
    const checkboxes = [];
    // The specific type of Data Validation that demarcates a UI checkbox.
    const CB = SpreadsheetApp.DataValidationCriteria.CHECKBOX;

    wb.getSheets().forEach(function (sheet) {
        var rg = sheet.getDataRange();
        var values = rg.getValues();
        /** @type {CheckboxSpec[]} */
        var sheetCheckBoxes = [];

        var dvRules = rg.getDataValidations();
        dvRules.forEach(function (row, r) { // Iterate data validations instead of values
            row.forEach(function (rule, c) {
                if (rule && rule.getCriteriaType() === CB) {
                    sheetCheckBoxes.push({
                        rowIndex: r,
                        colIndex: c,
                        r1c1: "R" + (r + 1) + "C" + (c + 1),
                        choices: (rule.getCriteriaValues().length ? rule.getCriteriaValues() : [true, false]),
                        value: values[r][c],
                    });
                }
            });
        });
        if (sheetCheckBoxes.length) {
            checkboxes.push({
                name: sheet.getName(),
                sheetId: sheet.getSheetId(),
                boxes: sheetCheckBoxes
            });
        }
    });

    return checkboxes;
}


function getAllCheckboxesViaAPI() {
    const wbId = SpreadsheetApp.getActive().getId();
    const fields = "sheets(data/rowData/values("
            + "dataValidation(condition(type,values/userEnteredValue)),"
            + "effectiveValue(boolValue,numberValue,stringValue)),"
        + "properties(sheetId,title))";
    const resp = Sheets.Spreadsheets.get(wbId, { fields: fields }); // Enable before use...
    if (!resp.sheets || !resp.sheets.length)
        return [];

    const checkboxes = [];
    resp.sheets.forEach(function (sheetObj) {
        if (!sheetObj.data || !sheetObj.data.length)
            return;
        /** @type {CheckboxSpec[]} */
        var sheetCheckBoxes = [];
        sheetObj.data.forEach(function (gridRange) {
            gridRange.rowData.forEach(function (row, r) {
                row.values.forEach(function (cell, c) {
                    if (cell.dataValidation && cell.dataValidation.condition
                        // Require the cell to be displayed as a Checkbox.
                        && cell.dataValidation.condition.type === "BOOLEAN") {
                        sheetCheckBoxes.push({
                            rowIndex: r,
                            colIndex: c,
                            r1c1: "R" + (r + 1) + "C" + (c + 1),
                            choices: (cell.dataValidation.condition.values ?
                                cell.dataValidation.condition.values : [true, false]),
                            value: cell.effectiveValue // object, e.g. {booleanValue: false} or {stringValue: "Yes"}
                        });
                    }
                });
            });
        });
        checkboxes.push({
            name: sheetObj.properties.title,
            sheetId: sheetObj.properties.sheetId,
            boxes: sheetCheckBoxes
        });
    });

    return checkboxes;
}

/**
 * Get only the specific checkboxes that have the specified checked & unchecked values.
 * @param {{name: string, sheetId: number, boxes: CheckboxSpec[]}[]} checkboxData The checkbox location data from a method like `getAllCheckboxesViaService`
 * @param {any} checkedVal The value associated with the checkboxes' "checked" state
 * @param {any} uncheckedVal The value associated with the checkboxes' "unchecked" state
 * @returns {{name: string, sheetId: number, boxes: CheckboxSpec[]}[]} Checkboxes that match the requested spec
 */
function getSpecificCBType(checkboxData, checkedVal, uncheckedVal) {
    const desiredCBs = checkboxData.filter(function (sheetObj) {
        return sheetObj.boxes.some(function (checkbox) {
            return checkbox.choices[0] === checkedVal && checkbox.choices[1] === uncheckedVal;
        });
    }).reduce(function (acc, sheetObj) {
        var desiredSheetCBs = sheetObj.boxes.filter(function (checkbox) {
            return checkbox.choices[0] === checkedVal && checkbox.choices[1] === uncheckedVal;
        });
        if (desiredSheetCBs.length) {
            acc.push({
                name: sheetObj.name,
                sheetId: sheetObj.sheetId,
                boxes: desiredSheetCBs
            });
        }
        return acc;
    }, []);
    return desiredCBs;
}


function resetSomeCBsViaService() {
    const allCBs = /* method from above */;
    const checkedValue = true;
    const uncheckedValue = false;
    const someCBs = getSpecificCBType(allCBs, checkedValue, uncheckedValue);
    const wb = SpreadsheetApp.getActive();

    // Set to checked, using a RangeList (could use Sheets API values#batchUpdate).
    someCBs.forEach(function (sheetObj) {
        wb.getSheetByName(sheetObj.name)
            .getRangeList(sheetObj.boxes.map(function (checkbox) { return checkbox.r1c1; }))
            .setValue(checkedValue);
    });
}

function resetSomeCBsViaAPI() {
    const allCBs = /* method from above */;
    const checkedValue = true;
    const uncheckedValue = false;
    const someCBs = getSpecificCBType(allCBs, checkedValue, uncheckedValue);
    const wbId = SpreadsheetApp.getActive().getId();

    const rq = someCBs.reduce(function (rqb, sheetObj) {
        var valueRanges = sheetObj.boxes.map(function (checkbox) {
            return {
                range: "'" + sheetObj.name + "'!" + checkbox.r1c1,
                values: [[checkedValue]]
            };
        });
        Array.prototype.push.apply(rqb.data, valueRanges);
        return rqb;
    }, { valueInputOption: "USER_ENTERED", data: [] });

    Sheets.Spreadsheets.Values.batchUpdate(rq, wbId);
}

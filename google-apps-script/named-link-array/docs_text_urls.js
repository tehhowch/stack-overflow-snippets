/** nested_json_parsing.js
 * Copyright (c) 2019 by tehhowch
 * This is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 * This is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE.  See the GNU General Public License for more details.
 */
//@ts-check
// @OnlyCurrentDoc
function sourceNames_() {
    return ["1", "2", "3", "4", "5", "6"];
}
function fragments_() {
    return ["11", "12", "13", "14", "15", "16"];
}
function toUrl_(fragment) {
    return "https://en.wikipedia.org/wiki/" + fragment + "/detection";
}

/**
 *
 * @param {GoogleAppsScript.Document.Document} [doc]
 */
function getDocText(doc) {
    return (doc ? doc : DocumentApp.getActiveDocument())
        .getBody()
        .getText();
}

/**
 *
 * @param {number} size
 * @param {any} [val]
 */
function makeArray_(size, val) {
    const a = [];
    while (size--)
        a.push(val);
    return a;
}

/**
 *
 * @param {GoogleAppsScript.Document.Paragraph} p
 */
function describeParagraph_(p) {
    const attrs = p.getAttributes();
    return {
        align: p.getAlignment(),
        attrs: Object.keys(attrs).reduce(function (keyVals, key) {
            keyVals[key] = attrs[key];
            return keyVals;
        }, {}),
        attrsCount: Object.keys(attrs).length,
        childCount: p.getNumChildren(),
        children: makeArray_(p.getNumChildren()).map(function (_, i) {
            return describeChild_(p.getChild(i));
        }),
        heading: p.getHeading(),
        link: p.getLinkUrl(),
        spacePre: p.getSpacingBefore(),
        spacePost: p.getSpacingAfter(),
        text: p.getText(),
        textAlign: p.getTextAlignment()
    };
}

/**
 *
 * @param {GoogleAppsScript.Document.Element} childElement
 */
function describeChild_(childElement) {
    switch (childElement.getType()) {
        case DocumentApp.ElementType.TEXT:
            return describeText_(childElement.asText());
        default:
            return {
                attrs: childElement.getAttributes(),
                elementType: childElement.getType()
            };
    }
}

/**
 *
 * @param {GoogleAppsScript.Document.Text} text
 */
function describeText_(text) {
    return {
        background: text.getBackgroundColor(),
        font: text.getFontFamily(),
        fontSize: text.getFontSize(),
        foreground: text.getForegroundColor(),
        link: text.getLinkUrl(),
        text: text.getText(),
        textAlign: text.getTextAlignment(),
        richTextIndices: text.getTextAttributeIndices(),
        bold: text.isBold(),
        italic: text.isItalic(),
        strike: text.isStrikethrough(),
        underline: text.isUnderline()
    };
}

/**
 *
 * @param {GoogleAppsScript.Document.Document} doc
 */
function getDocStats(doc) {
    const d = (doc ? doc : DocumentApp.getActiveDocument());
    const body = d.getBody();
    const paragraphs = body.getParagraphs();
    const tables = body.getTables();
    return {
        attrs: body.getAttributes(),
        fullText: body.getText(),
        fullTextAlign: body.getTextAlignment(),
        paragraphs: paragraphs.map(describeParagraph_),
        tables: tables.map(function (t) {
            return {
                attrs: t.getAttributes(),
                borders: {color: t.getBorderColor(), width: t.getBorderWidth()},
                link: t.getLinkUrl(),
                rows: makeArray_(t.getNumRows()).map(function (_, r) {
                    return t.getRow(r);
                }).map(function (row) {
                    return {
                        attrs: row.getAttributes(),
                        cells: makeArray_(row.getNumCells()).map(function (_, c) {
                            return row.getCell(c);
                        }).map(function (cell) {
                            return {
                                attrs: cell.getAttributes(),
                                background: cell.getBackgroundColor(),
                                link: cell.getLinkUrl(),
                                padding: {
                                    bottom: cell.getPaddingBottom(),
                                    top: cell.getPaddingTop(),
                                    left: cell.getPaddingLeft(),
                                    right: cell.getPaddingRight()
                                },
                                text: cell.getText(),
                                textAlign: cell.getTextAlignment()
                            };
                        }),
                        minHeight: row.getMinimumHeight(),
                        link: row.getLinkUrl(),
                        text: row.getText(),
                        textAlign: row.getTextAlignment()
                    };
                }),
                text: t.getText(),
                textAlign: t.getTextAlignment()
            };
        }),
        footnotes: body.getFootnotes().map(function (fn) {
            var contents = fn.getFootnoteContents();
            return {
                attrs: fn.getAttributes(),
                contents: {
                    attrs: contents.getAttributes(),
                    link: contents.getLinkUrl(),
                    text: contents.getText(),
                    textAlign: contents.getTextAlignment(),
                    hasMoreNotes: contents.getFootnotes().length > 0
                }
            };
        }),
        listItems: body.getListItems().map(function (li) {
            return {
                align: li.getAlignment(),
                attrs: li.getAttributes(),
                children: li.getNumChildren(),
                glyph: li.getGlyphType(),
                heading: li.getHeading(),
                indents: {firstLine: li.getIndentFirstLine(), end: li.getIndentEnd(), begin: li.getIndentStart()},
                lineSpacing: li.getLineSpacing(),
                link: li.getLinkUrl(),
                listId: li.getListId(),
                nesting: li.getNestingLevel(),
                text: li.getText(),
                textAlign: li.getTextAlignment()
            };
        }),
        children: body.getNumChildren(),
        page: {width: body.getPageWidth(), height: body.getPageHeight()},
        margins: {bottom: body.getMarginBottom(), top: body.getMarginTop(), left: body.getMarginLeft(), right: body.getMarginRight()}
    }
}

/**
 * Create links at the end of the given paragraph with the given text and the given urls.
 * @param {GoogleAppsScript.Document.Paragraph} pg The paragraph to hold the link array
 * @param {string[]} values The display text associated with the given links
 * @param {string[]} links The URI for the given link text
 * @param {string} [separator] text that should separate the given links. Default is comma + space, `", "`
 */
function appendLinkArray(pg, values, links, separator) {
    if (!pg || !values || !links)
        return;
    if (!values.length || !links.length || values.length > links.length)
        throw new Error("Bad input arguments");
    if (separator === undefined)
        separator = ", ";

    // Add a space before the link array if there isn't one at the end of any existing text.
    if (pg.getText() && (!pg.getText().match(/ $/) || !pg.getText().match(/ $/).length))
        pg.appendText(" ").setLinkUrl("");
    // Add each link display text as a new `Text` object, and set its link url.
    links.forEach(function (url, i) {
        var text = values[i] || url;
        pg.appendText(text)
            .setLinkUrl(0, text.length - 1, url);
        if (separator && i < links.length - 1)
            pg.appendText(separator).setLinkUrl("");
    });
    return pg;
}

function test() {
    const pgs = DocumentApp.getActiveDocument().getBody().getParagraphs();
    const last = pgs[pgs.length-1];
    const result = {};
    result.initial = describeParagraph_(last);
    appendLinkArray(last, sourceNames_(), fragments_().map(toUrl_), ", ");
    result.final = describeParagraph_(last);
    result.fullText = getDocText();
    return result;
}

/**
 * These two functions allow rudimentary parsing of a JSON feed based on input desired field paths.
 * Written to parse example nested data, using Google Apps Script native methods.
 */

 /**
  * Dive into the given object to obtain the property at the end of the path.
  * If the parent object is an array, will collate the property from all array elements.
  * This function is meant to be a callback to Array#reduce
  *
  * @param {Object|Array} parentObj The current object which contains a desired property to retrieve.
  * @param {string} property The current desired property to retrieve
  * @param {number} i The current index within the full path.
  * @param {string[]} fullPath The array of properties to be traversed to obtain the final desired property
  * @return {any} The value of the final desired property, which may be `undefined` if the property did not exist.
  */
 function delve_(parentObj, property, i, fullPath) {
    if (parentObj === undefined)
        return;

    // Simple case: parentObj is an Object, and property exists.
    const child = parentObj[property];
    if (child)
        return child;

    // Not a direct property / index, so perhaps a property on an object in an Array.
    if (parentObj.constructor === Array)
        // Since collate will call delve for future paths, we do not want to continue delving
        // once we get a result from collate. Use splice to signal our caller that there is no
        // more delving to do once we hand a result back.
        return collate_(parentObj, fullPath.splice(i));

    console.warn({message: "Unhandled case / missing property",
                  args: {parent: parentObj, prop: property, index: i, pathArray: fullPath}});
    return; // property didn't exist, user error.
}
/**
 * Continue following the given fields to obtain the final, desired property.
 *
 * @param {Object[]} arr An array of objects that should contain the given fields.
 * @param {string[]} fields An array of remaining properties to follow to obtain the desired result.
 * @return {any[]} An array of the desired final property.
 */
function collate_(arr, fields) {
    return arr.map(function (element) {
        // In order to preserve the delving fields for all elements of `arr`, use
        // slice to hand shallow copy to be consumed. Thus, the 2nd or 3rd element
        // of arr will have the same property trail to follow, even if we are accessing
        // arrays within another object.
        return fields.slice().reduce(delve_, element);
    });
}

function exampleUsage() {
    const data = [
      { "pubMedId": "1234",
        "name": "Jay Sahn",
        "publications": [
          { "pubId": "abcd",
            "issn": "A1B2C3",
            "title": "Dynamic JSON Parsing: A Journey into Madness",
            "authors": [
              { "pubMedId": "1234" },
              { "pubMedId": "2345" }
            ]
          },
          { "pubId": "efgh",
            "issn": "A1B2C3",
            "title": "Parsing API Responses",
            "authors": [
              { "pubMedId": "5678" }
            ]
          }
        ]
      }
    ];

    // paths relative to the outermost field, which for the above is an array of "author" objects
    const fields = ['pubMedId', 'name', 'publications/pubId', 'publications/title', 'publications/authors', 'publications/authors/pubMedId'];

    const output = data.map(function (author) {
        var row = fields.map(function (f) {
            var desiredField = f.split('/').reduce(delve_, author);
            return JSON.stringify(desiredField);
        });
        return row;
    });
    console.log({message:"Parsed fields", data: output});
    /**
    Stackdriver log entry:
    data: [
        0: [
            0:  "1234"
            1:  "Jay Sahn"
            2:  ["abcd","efgh"]
            3:  ["Dynamic JSON Parsing: A Journey into Madness","Parsing API Responses"]
            4:  [[{"pubMedId":"1234"},{"pubMedId":"2345"}],[{"pubMedId":"5678"}]]
            5:  [["1234","2345"],["5678"]]
        ]
    ]
    */
}

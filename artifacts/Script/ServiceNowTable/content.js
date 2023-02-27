const XMLParser = modules.xml2js;
const SystemId = req.query.systemid;
const SystemUrl = "/api/now/table/sys_dictionary?sysparm_fields=column_label,element&sysparm_query=name=" + req.query.table;
// const SystemUrl = "/api/now/table/sys_dictionary?sysparm_query=name=" + req.query.table;

let fields = [];

// Check for system ID
if (!SystemId) {
    result.data = { error: "Please select system" };
    return complete();
}

try {

    // Get Schema, to be able to get all fields
    const urlSchema = "/" + req.query.table + ".do?SCHEMA";

    // Convert to JSON
    const schemaXml = await globals.Utils.RequestHandler(urlSchema, SystemId, "xml");

    const schemaJson = await XMLParser.parseStringPromise(schemaXml.data, {
        explicitArray: false,
        mergeAttrs: true
    });

    const elements = schemaJson[req.query.table].element;

    // Get Dictionary Fields
    const res = await globals.Utils.RequestHandler(SystemUrl, SystemId, "json");

    if (res.error) {
        result.data = res;
        return complete();
    }

    console.log("SOAP ",elements.length)
    console.log("META ",res.data.result.length)

    elements.forEach(function (element) {

        const dictionary = res.data.result.find((f) => f.element === element.name);

        if (dictionary && dictionary.column_label) {
            element.label = dictionary.column_label;
        } else {
            element.label = element.name;
        }

        if (element.name === "upon_reject") {
            console.log(element);
            console.log(dictionary);
        }

        fields.push(element);

    });

    result.data = fields.sort(globals.Utils.SortBy("name"));
    complete();

} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}
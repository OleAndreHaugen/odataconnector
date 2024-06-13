const XMLParser = modules.xml2js;
const SystemId = req.query.systemid;
const SystemUrl =
    "/api/now/table/sys_dictionary?sysparm_fields=column_label,element&sysparm_query=name=" +
    req.query.table;

let fields = [];

// Check for system ID
if (!SystemId) {
    result.data = { error: "Please select system" };
    return complete();
}

try {
    // Check if xml2js is installed
    if (!XMLParser) {
        result.data = { error: "Missing NPM module xml2js.Please install from NPM Modules" };
        return complete();
    }

    // Get Schema, to be able to get all fields
    const urlSchema = "/" + req.query.table + ".do?SCHEMA";

    // Convert to JSON
    const schemaXml = await globals.Utils.RequestHandler(urlSchema, SystemId, "xml");

    if (schemaXml.error) {
        result.data = res;
        return complete();
    }

    if (schemaXml.message) {
        result.data = { error: res.message };
        return complete();
    }

    const schemaJson = await XMLParser.parseStringPromise(schemaXml.data, {
        explicitArray: false,
        mergeAttrs: true,
    });

    const elements = schemaJson[req.query.table].element;

    // Get Dictionary Fields
    const res = await globals.Utils.RequestHandler(SystemUrl, SystemId, "json");

    if (res.error) {
        result.data = res;
        return complete();
    }

    for (let i = 0; i < elements.length; i++) {
        let element = elements[i];

        // System ID Field will be applied automatically
        if (element.name === "sys_id") continue;

        const dictionary = res.data.result.find((f) => f.element === element.name);

        if (dictionary && dictionary.column_label) {
            element.label = dictionary.column_label;
        } else {
            element.label = UpperCaseArray(element.name);
        }

        // Choice Lists - Do it here vs AdaptiveSetup -> better performance but need to update when the choice list changes
        if (element.choice_list === "true") {
            const choiceUrl =
                "/api/now/table/sys_choice?sysparm_fields=label,value&sysparm_query=name=" +
                req.query.table +
                "^element=" +
                element.name;
            const resChoices = await globals.Utils.RequestHandler(choiceUrl, SystemId, "json");

            if (resChoices.data.result && resChoices.data.result.length) {
                element.items = [];
                resChoices.data.result.forEach(function (item) {
                    item.sel = true;
                    element.items.push(item);
                });
            } else {
                element.choice_list = "false";
            }
        }

        fields.push(element);
    }

    result.data = fields.sort(globals.Utils.SortBy("name"));
    complete();
} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}

function UpperCaseArray(input) {
    let result = input.split("_");
    let label = "";
    let sep = "";

    result.forEach(function (part) {
        label += sep + part.charAt(0).toUpperCase() + part.slice(1);
        sep = " ";
    });

    return label;
}

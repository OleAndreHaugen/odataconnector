const connector = await entities.neptune_af_connector.findOne({
    select: ["config", "systemid"],
    where: { id: req.body._connector.settings.startParam }
});

if (!connector) return complete();

const SystemId = connector.systemid;
const SystemUrl = "/api/now/table/" + connector.config.table + "?sysparm_display_value=true&sysparm_input_display_value=true";
const UniqueIdField = "sys_id";

// Handle Method
switch (req.query.method) {

    case "Delete":
        await processDelete(req);
        break;

    case "Save":
        await processSave(req);
        break;

    case "Get":
        await processGet(req);
        break;

    default:
        await processList(req);
        break;

}


async function processDelete() {

    result.data = {
        status: "ERROR",
        message: {
            type: "error",
            text: "Delete not currently supported."
        }
    }

    complete();
}

async function processSave() {

    if (!req.body[UniqueIdField]) {
        result.data = {
            status: "ERROR",
            message: {
                type: "error",
                text: "Create not currently supported."
            }
        }
        return complete();
    }

    const queryUrl = "/api/now/table/" + connector.config.table + "/" + req.body[UniqueIdField];

    let opts = {
        body: {},
        method: "PATCH",
    }

    // Get fields from Form 
    req.body._settings.fieldsSel.forEach(function (field) {
        opts.body[field.name] = req.body[field.name];
    });

    // Stringify JSON Data
    opts.body = JSON.stringify(opts.body);

    // Query Table 
    const res = await globals.Utils.RequestHandler(queryUrl, SystemId, "json", opts);

    if (res.data && res.data.error) {
        result.data = {
            status: "ERROR",
            message: {
                type: "error",
                text: res.data.error.detail
            },
            debug: res.data
        }
    } else {
        result.data = {
            status: "OK",
        }
    }

    complete();
}


async function processGet() {

    let queryUrl = "/api/now/table/" + connector.config.table + "?sysparm_display_value=all&sysparm_limit=1";;
    let queryFields = UniqueIdField;
    let queryFilter = "";
    let sep = ",";
    let tableData = {};

    //  Fields Selection 
    if (req.body._settings.fieldsSel) {
        req.body._settings.fieldsSel.forEach(function (field) {
            queryFields += sep + field.name;
        });
    }

    // Where 
    if (req.body[UniqueIdField]) queryFilter += UniqueIdField + "=" + req.body[UniqueIdField];

    // URL
    if (queryFilter) queryUrl += "&sysparm_query=" + queryFilter;
    if (queryFields) queryUrl += "&sysparm_fields=" + queryFields;

    // Query Table 
    const res = await globals.Utils.RequestHandler(queryUrl, SystemId, "json");

    // Format Result Data
    if (res.data && res.data.result && res.data.result.length) {

        let resData = res.data.result[0];
        let fieldCatalog = req.body._settings.fieldsSel;

        fieldCatalog.forEach(function (field) {

            switch (field.type) {
                case "SingleSelect":
                case "SingleSelectLookup":
                case "MultiSelect":
                case "MultiSelectLookup":
                    tableData[field.name] = resData[field.name].value;
                    break;

                default:
                    tableData[field.name] = resData[field.name].display_value;
                    break;
            }

        });

        // Add sys_id
        tableData[UniqueIdField] = resData[UniqueIdField].value;


    } else {

        result.data = {
            status: "ERROR",
            message: {
                type: "error",
                text: "No record found with selected filter."
            }
        }

        return complete();
    }

    result.data = tableData;
    complete();


}


async function processList() {

    let queryUrl = SystemUrl;
    let queryFields = "sys_id";
    let queryFilter = "";
    let whereSep = "";
    let sep = ",";


    // API Query - Select
    if (req.body._settings.fieldsRun) {
        req.body._settings.fieldsRun.forEach(function (field) {
            queryFields += sep + field.name;
        });
    }

    // API Query - Filter
    const bodyFields = Object.keys(req.body);

    bodyFields.forEach(function (fieldName) {

        const fieldValue = req.body[fieldName];
        if (!fieldValue) return;

        const fieldSel = req.body._settings.fieldsSel.find((f) => f.name === fieldName);
        if (!fieldSel) return;

        switch (fieldSel.type) {

            case "CheckBox":
            case "Switch":
                queryFilter += whereSep + fieldName + "=" + fieldValue;
                break;

            case "DateRange":
                queryFilter += whereSep + fieldName + ">=" + fieldValue;
                whereSep = " and ";
                queryFilter += whereSep + fieldName + "<=" + req.body[fieldName + "_end"];
                break;

            case "SingleSelect":
            case "SingleSelectLookup":
            case "SingleSelectScript":
                queryFilter += whereSep + fieldName + "=" + fieldValue;
                break;

            case "MultiSelect":
            case "MultiSelectLookup":
            case "MultiSelectScript":
                multiFilter = "";
                sep = "";

                fieldValue.forEach(function (value) {
                    multiFilter += sep + fieldValue;
                    sep = ",";
                });

                queryFilter += whereSep + fieldName + "IN" + multiFilter;

                // multiFilter = "";
                // sep = "";

                // fieldValue.forEach(function (value) {
                //     // multiFilter += sep + fieldValue;
                //     multiFilter += sep + fieldName + "LIKE" + value;
                //     sep = "^OR";
                // });

                // // queryFilter += whereSep + fieldName + "IN" + multiFilter;

                // queryFilter += whereSep + multiFilter;


                break;

            default:
                if (fieldSel.selEqual) {
                    queryFilter += whereSep + fieldName + "=" + fieldValue;
                } else {
                    queryFilter += whereSep + fieldName + "LIKE" + fieldValue;
                }
                break;

        }

        whereSep = "^";

    });


    // API Query - Pagination
    if (req.body._pagination) {
        queryUrl += "&sysparm_limit=" + req.body._pagination.take;
        queryUrl += "&sysparm_offset=" + req.body._pagination.skip;
    }

    // // API Query - Order
    if (req.body._order) {

        const orderField = Object.keys(req.body._order)[0];

        if (orderField) {

            const orderType = req.body._order[orderField];

            if (orderType === "ASC") {
                queryFilter += whereSep + "ORDERBY" + orderField;
            } else {
                queryFilter += whereSep + "ORDERBYDESC" + orderField;
            }

        }

    }

    // URL
    if (queryFilter) queryUrl += "&sysparm_query=" + queryFilter;
    if (queryFields) queryUrl += "&sysparm_fields=" + queryFields;

    const res = await globals.Utils.RequestHandler(queryUrl, SystemId, "json");

    const count = res.headers.get("X-Total-Count");

    // Format Result Data
    if (res.data && res.data.result && res.data.result.length) {

        let fieldCatalog = req.body._settings.fieldsRun;

        res.data.result.forEach(function (row) {
            fieldCatalog.forEach(function (field) {
                if (row[field.name] && typeof row[field.name] === "object") {
                    row[field.name] = row[field.name].display_value;
                }
            });
        })
    }

    result.data = {
        count: count,
        result: res.data.result,
        debug: {
            url: queryUrl,
        }
    }

    complete();

}
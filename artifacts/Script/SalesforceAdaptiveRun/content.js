// Get Connector
const connector = await entities.neptune_af_connector.findOne({
    select: ["config", "systemid"],
    where: { id: req.body._connector.settings.startParam }
});

if (!connector) return complete();

let selectedFields = []
const SystemId = connector.systemid;
const SystemUrl = "/services/data/v56.0/query?q=";

// Get all selected fields
await getFields();

// Handle Method
switch (req.query.method) {

    case "Delete":
        processDelete();
        break;

    case "Save":
        await processSave(req);
        break;

    default:
        await processListAndGet(req);
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

async function processSave(req) {

    let dataPatch = {};

    // Get fields from Form 
    req.body._settings.fieldsSel.forEach(function (field) {

        let fieldMeta = selectedFields.find((f) => f.name === field.name);
        if (!fieldMeta) fieldMeta = {};

        if (field.editable && fieldMeta.updateable) {
            dataPatch[field.name] = req.body[field.name];
        }

    });

    try {

        // Requires ID in form // TODO - Make this automatic
        if (!req.body.Id) {

            result.data = {
                status: "ERROR",
                message: {
                    type: "error",
                    text: "Missing Id field in FORM"
                }
            }

            return complete();

        }

        // TODO Rewrite to Utils instead of API
        const responseSave = await apis.patch({
            id: req.body.Id,
            table: connector.config.table,
            data: dataPatch
        });

        result.data = {
            status: "OK",
            debug: {
                dataPatch,
                settings: req.body._settings,
                res: responseSave.data

            }
        }

        complete();

    } catch (e) {

        let message = {
            type: "error",
            text: ""
        }

        if (e && e.message) message.text = e.message;

        result.data = {
            status: "ERROR",
            message: message,
            event: e,
            debug: {
                dataPatch,
                settings: req.body._settings,
            }
        }

        complete();

    }

}

async function processListAndGet(req) {

    let counter = 0;
    let pagination = "";
    let queryData = "";
    let order = "";
    let where = "";
    let whereSep = "";
    let fields = "";
    let sep = "";

    try {

        //  Fields Selection 
        if (req.query.method == "Get") {

            if (req.body._settings.fieldsSel) {

                req.body._settings.fieldsSel.forEach(function (field) {
                    fields += sep + field.name;
                    sep = ",";
                });

            }

            // Where 
            req.body._keyField.forEach(function (keyField) {
                where += whereSep + keyField.fieldName + " = '" + req.body[keyField.fieldName] + "'";
                whereSep = " AND ";
            });

        } else {

            // Selected Fields
            if (req.body._settings.fieldsRun) {
                req.body._settings.fieldsRun.forEach(function (field) {
                    fields += sep + field.name;
                    sep = ",";
                });
            } else {
                return { error: "No fields to display in table" };
            }

            // Where 
            const bodyFields = Object.keys(req.body);

            bodyFields.forEach(function (fieldName) {

                if (fieldName.substr(0, 1) !== "_") {

                    const fieldValue = req.body[fieldName];
                    if (!fieldValue) return;

                    const fieldSel = req.body._settings.fieldsSel.find((f) => f.name === fieldName);
                    if (!fieldSel) return;

                    let fieldMeta = selectedFields.find((f) => f.name === fieldName);
                    if (!fieldMeta) fieldMeta = {};

                    switch (fieldSel.type) {

                        case "CheckBox":
                        case "Switch":
                            where += whereSep + " " + fieldName + " = " + fieldValue;
                            whereSep = " AND ";
                            break;

                        case "DateRange":
                            where += whereSep + " " + fieldName + " >= " + fieldValue;
                            whereSep = " AND ";
                            where += whereSep + " " + fieldName + " <= " + req.body[fieldName + "_end"];
                            whereSep = " AND ";
                            break;

                        case "SingleSelect":
                        case "SingleSelectLookup":
                        case "SingleSelectScript":
                            if (fieldMeta.type === "datetime") {
                                where += whereSep + " " + fieldName + " = " + fieldValue;
                            } else {
                                where += whereSep + " " + fieldName + " = '" + fieldValue + "'";
                            }
                            whereSep = " AND ";
                            break;

                        case "MultiSelect":
                        case "MultiSelectLookup":
                        case "MultiSelectScript":
                            let includes = "";
                            let sep = "";

                            fieldValue.forEach(function (value) {
                                includes += sep + "'" + value + "'";
                                sep = ",";
                            });

                            if (includes) {
                                where += whereSep + " " + fieldName + " IN (" + includes + ")";
                                whereSep = " AND ";
                            }
                            break;

                        default:
                            if (fieldMeta.type === "id" || fieldMeta.type === "reference") {
                                where += whereSep + " " + fieldName + " = '" + fieldValue + "'";
                            } else if (fieldMeta.type === "boolean") {
                                where += whereSep + " " + fieldName + " = " + fieldValue;
                            } else {
                                where += whereSep + " " + fieldName + " LIKE '%" + fieldValue + "%'";
                            }
                            whereSep = " AND ";
                            break;

                    }

                }

            });

        }

        // API Query - Order
        if (req.body._order) {

            const orderField = Object.keys(req.body._order)[0];

            if (orderField) {
                const orderType = req.body._order[orderField];
                order += " ORDER BY " + orderField + " " + orderType;
            }

        }

        // API Query - Pagination
        if (req.body._pagination) {

            let queryCount = "SELECT count() FROM " + connector.config.table;
            if (where) queryCount += " WHERE " + where;

            const urlCount = SystemUrl + queryCount;
            const responseCount = await globals.Utils.RequestHandler(urlCount, SystemId, "json");

            if (responseCount && responseCount.data && responseCount.data.totalSize) counter = responseCount.data.totalSize;

            pagination += " LIMIT " + req.body._pagination.take;
            pagination += " OFFSET " + req.body._pagination.skip;

        }

        // API Query - Build
        queryData = "SELECT " + fields + " FROM " + connector.config.table;

        if (where) queryData += " WHERE " + where;
        if (order) queryData += order;
        if (pagination) queryData += pagination;

        const urlRecords = SystemUrl + queryData;
        const responseRecords = await globals.Utils.RequestHandler(urlRecords, SystemId, "json");

        // Merge LookupFields from SalesForce
        let fieldCatalog;

        if (req.query.method == "Get") {
            fieldCatalog = req.body._settings.fieldsSel;
        } else {
            fieldCatalog = req.body._settings.fieldsRun;
        }

        if (responseRecords && responseRecords.data && responseRecords.data.records) {

            responseRecords.data.records.forEach(function (row) {

                delete row["attributes"];

                // Populate Data
                fieldCatalog.forEach(function (field) {

                    if (field.name.indexOf(".") > -1) {

                        const lookupData = field.name.split(".");

                        switch (lookupData.length) {
                            case 5:
                                if (row[lookupData[0]][lookupData[1]][lookupData[2]][lookupData[3]]) row[field.name] = row[lookupData[0]][lookupData[1]][lookupData[2]][lookupData[3]][lookupData[4]];
                                break;
                            case 4:
                                if (row[lookupData[0]][lookupData[1]][lookupData[2]]) row[field.name] = row[lookupData[0]][lookupData[1]][lookupData[2]][lookupData[3]];
                                break;
                            case 3:
                                if (row[lookupData[0]][lookupData[1]]) row[field.name] = row[lookupData[0]][lookupData[1]][lookupData[2]];
                                break;
                            case 2:
                                if (row[lookupData[0]]) row[field.name] = row[lookupData[0]][lookupData[1]];
                                break;
                            default:
                                row[field.name] = "";
                                break;
                        }

                    }

                    if (row[field.name] === null) row[field.name] = "";
                });

                // Cleanup Data
                fieldCatalog.forEach(function (field) {
                    if (field.name.indexOf(".") > -1) {
                        const lookupData = field.name.split(".");
                        delete row[lookupData[0]]
                    }
                });

            });

        }

        // Send Response to Client
        if (req.query.method == "Get") {
            result.data = responseRecords.data.records;
        } else {

            if (!req.body._pagination) counter = responseRecords.data.records.length;

            result.data = {
                result: responseRecords.data.records || [],
                count: counter,
                debug: {
                    queryData,
                }
            }

        }

        complete();

    } catch (e) {

        let message = {
            type: "error",
            text: ""
        }

        if (e && e.message) message.text = e.message;

        result.data = {
            status: "ERROR",
            message: message,
            event: e,
            debug: {
                queryData,
            }
        }

        complete();

    }

}

async function getFields() {

    connector.config.fields.forEach(async function (field) {

        if (field.sel) {
            selectedFields.push({
                name: field.name,
                label: field.label,
                type: field.type,
                updateable: field.updateable,
            });
        }

    })

}
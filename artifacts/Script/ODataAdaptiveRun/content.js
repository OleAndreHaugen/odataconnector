let selectFields = ["config", "systemid"];
if (req.query.method === "ValueListSetup") selectFields.push("metadata");

// Get Connector Data
const connector = await entities.neptune_af_connector.findOne({
    select: selectFields,
    where: { id: req.body._connector.settings.startParam }
});

if (!connector) return complete();

const Service = connector.config.service;
const SystemId = connector.systemid;

// Process Method
switch (req.query.method) {

    case "ValueListSetup":
        processValueListSetup();
        break;

    case "ValueListRun":
        processValueListRun();
        break;

    case "Save":
        processSave();
        break;

    default:
        processListAndGet();
        break;
}


// ValueList - Selection
async function processValueListSetup() {

    try {

        // Metadata is updated from cockpit app, press update on fields
        const entitySets = connector.metadata["edmx:Edmx"]["edmx:DataServices"].Schema.EntityContainer.EntitySet;
        const entityTypes = connector.metadata["edmx:Edmx"]["edmx:DataServices"].Schema.EntityType;
        const annotations = connector.metadata["edmx:Edmx"]["edmx:DataServices"].Schema.Annotations;
        const valueLists = [];

        // Find all annotations
        annotations.forEach(function (annotation) {

            if (annotation.Target === req.body._valueListTarget && annotation.Annotation.Term === "com.sap.vocabularies.Common.v1.ValueList") {

                const valueListCollectionPath = annotation.Annotation.Record.PropertyValue.find(value => value.Property === "CollectionPath");
                const valueListParameters = annotation.Annotation.Record.PropertyValue.find(value => value.Property === "Parameters").Collection.Record;
                const valueListSearchSupported = annotation.Annotation.Record.PropertyValue.find(value => value.Property === "SearchSupported");
                const valueListLabel = annotation.Annotation.Record.PropertyValue.find(value => value.Property === "Label");

                let valueListKeyField;
                let valueListFields = [];

                // Value List Fields
                valueListParameters.forEach(function (record) {

                    if (record.PropertyValue.length) {
                        record.PropertyValue.forEach(function (PropertyValue) {
                            if (PropertyValue.Property === "ValueListProperty") valueListFields.push(PropertyValue.String);
                            if (record.Type === "com.sap.vocabularies.Common.v1.ValueListParameterInOut") valueListKeyField = PropertyValue.String;
                        });
                    } else {
                        valueListFields.push(record.PropertyValue.String);
                        if (record.Type === "com.sap.vocabularies.Common.v1.ValueListParameterInOut") valueListKeyField = record.PropertyValue.String;
                    }

                });

                const entitySet = entitySets.find(entitySets => entitySets.Name === valueListCollectionPath.String);
                const entityTypeName = entitySet.EntityType.split(".");
                const entityType = entityTypes.find(entityTypes => entityTypes.Name === entityTypeName[entityTypeName.length - 1]);

                //  Value Help Fields
                let fields = [];
                entityType.Property.forEach(function (property) {

                    const field = {
                        type: property.Type.split(".")[1].toLowerCase(),
                        name: property.Name,
                        label: property["sap:label"],
                    }

                    // Value Help
                    if (property["sap:value-list"]) {
                        const valueListTarget = entitySet.EntityType + "/" + property.Name;
                        field.valueListTarget = valueListTarget;
                    }

                    if (valueListFields.includes(property.Name)) fields.push(field);

                })

                let res = {
                    fields: fields,
                    valueListLabel: (valueListLabel ? valueListLabel.String : valueListCollectionPath.String),
                    valueListKeyField: valueListKeyField,
                    valueListSearchSupported: (valueListSearchSupported ? true : false),
                    valueListCollectionPath: valueListCollectionPath.String
                }

                valueLists.push(res);

            }

        })

        result.data = valueLists;
        complete();

    } catch (e) {

        result.data = {
            error: e

        }
        complete();

    }

}

async function processValueListRun() {

    let whereSep = "";

    let opts = {
        parameters: {
            "$inlinecount": "allpages",
            "$format": "json",
            "$top": 100,
            "$filter": "",
        }
    }

    let SystemUrl = "/sap/opu/odata/sap/" + Service + "/" + req.body._entitySet + "?$inlinecount=allpages&$format=json&$top=100";

    try {

        // API Query - Filter
        const bodyFields = Object.keys(req.body);

        bodyFields.forEach(function (fieldName) {

            const fieldValue = req.body[fieldName];
            if (!fieldValue) return;

            // Search Field
            if (fieldName === "_search") {
                opts.parameters.search = fieldValue;
            }

            // Filter Fields
            if (fieldName.substr(0, 1) !== "_") {
                opts.parameters.$filter += whereSep + "substringof(" + fieldName + "," + "'" + fieldValue + "')";
                whereSep = " and ";
            }

        });

        if (opts.parameters.$filter) SystemUrl += "&$filter=" + opts.parameters.$filter;
        if (opts.parameters.search) SystemUrl += "&search=" + opts.parameters.search;
        if (opts.parameters.$orderby) SystemUrl += "&$orderby=" + opts.parameters.$orderby;

        const res = await globals.Utils.RequestHandler(SystemUrl, SystemId, "json");

        // const res = await apis.get(opts);

        result.data = {
            result: res.data.d.results,
            count: res.data.d.__count,
            debug: {
                req: req.body,
                opts: opts,
            }
        }

        return complete();

    } catch (error) {
        log.error("Error in request: ", error);
        result.data = {
            error: error,
            debug: {
                req: req.body,
                opts: opts
            }

        }
        return complete();
    }

}


// List Data
async function processListAndGet() {

    let sep = "";
    let whereSep = "";
    let multiFilter = "";

    let SystemUrl = "/sap/opu/odata/sap/" + Service + "/" + connector.config.entitySet + "?$inlinecount=allpages&$format=json";

    let opts = {
        parameters: {
            "$inlinecount": "allpages",
            "$format": "json",
            "$orderby": "",
            "$select": "",
            "$filter": "",
        }
    }

    try {

        // Different Handling from Get vs List
        if (req.query.method == "Get") {

            // API Query - Select
            if (req.body._settings.fieldsSel) {
                req.body._settings.fieldsSel.forEach(function (field) {
                    opts.parameters.$select += sep + field.name;
                    sep = ",";
                });
            }

            // API Query - Filter
            if (req.body.__metadata && req.body.__metadata.id) {
                const parts = req.body.__metadata.id.split("/");
                SystemUrl = "/sap/opu/odata/sap/" + Service + "/" + parts[parts.length - 1] + "?&$format=json";
            }

        } else {

            // API Query - Select
            if (req.body._settings.fieldsRun) {
                req.body._settings.fieldsRun.forEach(function (field) {
                    opts.parameters.$select += sep + field.name;
                    sep = ",";
                });
            }

            // API Query - Filter
            const bodyFields = Object.keys(req.body);

            bodyFields.forEach(function (fieldName) {

                if (fieldName.substr(0, 1) !== "_") {

                    const fieldValue = req.body[fieldName];
                    if (!fieldValue) return;

                    const fieldSel = req.body._settings.fieldsSel.find((f) => f.name === fieldName);
                    if (!fieldSel) return;

                    switch (fieldSel.type) {

                        case "CheckBox":
                        case "Switch":
                            opts.parameters.$filter += whereSep + " " + fieldName + " = " + fieldValue;
                            break;

                        case "DateRange":
                            opts.parameters.$filter += whereSep + " " + fieldName + " >= " + fieldValue;
                            whereSep = " and ";
                            opts.parameters.$filter += whereSep + " " + fieldName + " <= " + req.body[fieldName + "_end"];
                            break;

                        case "SingleSelect":
                        case "SingleSelectLookup":
                        case "SingleSelectScript":
                            if (fieldMeta.type === "datetime") {
                                opts.parameters.$filter += whereSep + " " + fieldName + " = " + fieldValue;
                            } else {
                                opts.parameters.$filter += whereSep + " " + fieldName + " = '" + fieldValue + "'";
                            }
                            break;

                        case "MultiSelect":
                        case "MultiSelectLookup":
                        case "MultiSelectScript":
                        case "ValueHelpOData":
                            multiFilter = "";
                            sep = "";

                            fieldValue.forEach(function (value) {
                                multiFilter += sep + fieldName + " eq '" + value + "'";
                                sep = " or ";
                            });

                            opts.parameters.$filter += whereSep + "(" + multiFilter + ")";
                            break;

                        case "ValueHelpOData":
                            multiFilter = "";
                            sep = "";

                            fieldValue.forEach(function (value) {
                                multiFilter += sep + "substringof(" + fieldName + "," + "'" + value + "')";
                                sep = " or ";
                            });

                            opts.parameters.$filter += whereSep + multiFilter;
                            break;

                        default:

                            if (fieldSel.selEqual) {
                                opts.parameters.$filter += whereSep + fieldName + " eq " + "'" + fieldValue + "'";
                            } else {
                                opts.parameters.$filter += whereSep + "substringof(" + fieldName + "," + "'" + fieldValue + "')";
                            }
                            break;

                    }

                    whereSep = " and ";

                }

            });

        }

        // API Query - Pagination
        if (req.body._pagination) {
            opts.parameters.$top = req.body._pagination.take;
            opts.parameters.$skip = req.body._pagination.skip;
        }

        // API Query - Order
        if (req.body._order) {

            const orderField = Object.keys(req.body._order)[0];

            if (orderField) {
                const orderType = req.body._order[orderField];
                opts.parameters.$orderby = orderField + " " + orderType.toLowerCase();
            }

        }

        if (opts.parameters.$filter) SystemUrl += "&$filter=" + opts.parameters.$filter;
        if (opts.parameters.$top) SystemUrl += "&$top=" + opts.parameters.$top;
        if (opts.parameters.$skip) SystemUrl += "&$skip=" + opts.parameters.$skip;
        if (opts.parameters.$orderby) SystemUrl += "&$orderby=" + opts.parameters.$orderby;
        if (opts.parameters.$select) SystemUrl += "&$select=" + opts.parameters.$select;

        const res = await globals.Utils.RequestHandler(SystemUrl, SystemId, "json");

        // opts.service = Service;
        // opts.entitySet = connector.config.entitySet;
        // const res = await apis.get(opts);

        // Adaptive Framework Binding 
        if (res.data.d && res.data.d.results && res.data.d.results.length) {
            res.data.d.results.forEach(function (row) {
                formatData(row);
            });
        } else {
            formatData(res.data.d);
        }

        if (req.query.method === "Get") {
            result.data = res.data.d;
        } else {
            result.data = {
                result: res.data.d.results,
                count: res.data.d.__count,
                debug: {
                    opts: opts,
                    SystemUrl: SystemUrl
                }
            }
        }
        complete();

    } catch (error) {
        log.error("Error in request: ", error);
        result.data = {
            error: error,
            debug: {
                req: req.body,
                opts: opts
            }

        }
        complete();
    }

}

async function processSave() {

    let dataPatch = {};
    let sep = "";
    let whereSep = "";
    let resSave;
    let resFetch;

    let opts = {
        service: Service,
        entitySet: connector.config.entitySet,
        parameters: {
            "$select": "",
        },
        headers: {
            "x-csrf-token": "fetch",
            "cookie": "",
        },
    }

    // API Query - Select & Data
    req.body._settings.fieldsSel.forEach(function (field) {

        // Data to Save
        if (field.editable) dataPatch[field.name] = req.body[field.name];

        // Fields to Select
        opts.parameters.$select += sep + field.name;
        sep = ",";

    });

    // API Query - Filter
    if (req.body.__metadata && req.body.__metadata.id) {
        const parts = req.body.__metadata.id.split("/");
        opts.entitySet = parts[parts.length - 1];
    }

    try {

        // Fetxh x-csrf-token
        resFetch = await apis.get(opts);

        if (resFetch.headers["x-csrf-token"]) {
            opts.headers["x-csrf-token"] = resFetch.headers["x-csrf-token"];
        } else {
            delete opts.headers["x-csrf-token"];
        }


        // "XSRF-TOKEN"
        // "X-XSRF-TOKEN"

        // Cookie Handler
        const cookies = resFetch.headers["set-cookie"];

        sep = "";
        cookies.forEach(function (cookie) {
            opts.headers["cookie"] += sep + cookie;
            sep = ";"
        });

        // Save data with x-csrf-token
        resSave = await apis.save(opts);

        result.data = {
            status: "OK",
            debug: {
                opts,
                dataPatch,
                headers: resFetch.headers
            }
        }

        complete();

    } catch (error) {

        let errorMessage = "";
        if (error && error.message) errorMessage = error.message;

        log.error("Error in request: ", error);
        result.data = {
            error: error,
            debug: {
                // resSave: resSave.data,
                // resFetch: resFetch.data,
                req: req.body,
                dataPatch,
                opts: opts
            },
            message: {
                text: errorMessage
            }

        }
        complete();
    }

}

async function formatData(row) {

    rowFields = Object.keys(row);

    rowFields.forEach(function (fieldName) {

        const fieldRun = req.body._settings.fieldsRun.find((f) => f.name === fieldName);

        if (fieldRun) {

            switch (fieldRun.type) {

                case "ObjectStatus":

                    // Unit
                    if (fieldRun.statusUnitType === "Binding") row[fieldName + "_unit"] = row[fieldRun.statusUnitBinding];
                    if (fieldRun.statusUnitType === "Fixed") row[fieldName + "_unit"] = fieldRun.statusUnitFixed;

                    // State
                    if (fieldRun.statusStateType === "Binding") row[fieldName + "_state"] = row[fieldRun.statusStateBinding];
                    if (fieldRun.statusStateType === "Fixed") row[fieldName + "_state"] = fieldRun.statusStateFixed;

                    // Icon
                    if (fieldRun.statusIconType === "Binding") row[fieldName + "_icon"] = row[fieldRun.statusIconBinding];
                    if (fieldRun.statusIconType === "Fixed") row[fieldName + "_icon"] = fieldRun.statusIconFixed;

                    // Title
                    if (fieldRun.statusTitleType === "Binding") row[fieldName + "_title"] = row[fieldRun.statusTitleBinding];
                    if (fieldRun.statusTitleType === "Fixed") row[fieldName + "_title"] = fieldRun.statusTitleFixed;

                    break;

                case "ObjectNumber":

                    // Unit
                    if (fieldRun.numberUnitType === "Binding") row[fieldName + "_unit"] = row[fieldRun.numberUnitBinding];
                    if (fieldRun.numberUnitType === "Fixed") row[fieldName + "_unit"] = fieldRun.numberUnitFixed;

                    // State
                    if (fieldRun.numberStateType === "Binding") row[fieldName + "_state"] = row[fieldRun.numberStateBinding];
                    if (fieldRun.numberStateType === "Fixed") row[fieldName + "_state"] = fieldRun.numberStateFixed;

                    break;

                default:
                    break;
            }
        }

        // DateTime Format 
        if (row[fieldName].indexOf && row[fieldName].indexOf("/Date(") > -1) {
            const raw = row[fieldName].split("/Date(")[1];
            row[fieldName] = parseInt(raw);
        }

    });

}